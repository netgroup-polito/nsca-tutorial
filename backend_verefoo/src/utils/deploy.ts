import { Queue } from "./queue";
import { ContainerLabNode, DeployNode, VerefooNode } from "./types";

let router_ip = "10.10.0.0";

function ipToInt(ip: string) {
	const [network, cidr] = ip.split("/");
	const [part0, part1, part2, part3] = network.split(".").map(Number);

	return (part0 << 24) | (part1 << 16) | (part2 << 8) | part3;
}

function intToIP(int: number): string {
	const part0 = (int >>> 24) & 0xff;
	const part1 = (int >>> 16) & 0xff;
	const part2 = (int >>> 8) & 0xff;
	const part3 = int & 0xff;

	return `${part0}.${part1}.${part2}.${part3}`;
}

function findSubnet (ip: string) {
	const parts = ip.split(".");
	if (!parts.some((p) => p === "*" || p === "-1")) {
		return parts[0] + "." + parts[1] + "." + parts[2] + ".0/24";
	} else {
		if (parts[0] === "*" || parts[0] === "-1") {
			return "0.0.0.0/0";
		}
		if (parts[1] === "*" || parts[1] === "-1") {
			return parts[0] + ".0.0.0/8";
		}
		if (parts[2] === "*" || parts[2] === "-1") {
			return parts[0] + "." + parts[1] + ".0.0/16";
		}
		if (parts[3] === "*" || parts[3] === "-1") {
			return parts[0] + "." + parts[1] + "." + parts[2] +".0/24";
		} 
	}
}

function assignIPfromSubnet (subnet: string, subnets: Map<string, string[]>) {
	const assignedIPs = new Set<string>(subnets.get(subnet));
	const [network, cidr] = subnet.split("/");
	const ipsPerSubnet = Math.pow(2, 32 - parseInt(cidr))
	
	const baseAddr = ipToInt(network);

	for (let i = 1; i < ipsPerSubnet - 1; i++) {
		const ip = intToIP(baseAddr + i);
		if (!assignedIPs.has(ip)) {
			subnets.set(subnet, [...(subnets.get(subnet) || []), ip]);
			return ip + "/" + cidr;
		}
	}

	throw new Error ("IPs exhausted");
}


// This is the function that maps the internal IP to the userIp on the interface of the NAT that connects to the outside network
// It is used to convert the firewall rules provided by Verefoo to the internal IPs that our deployment assigned
export function natInternalToUserIpTranslate(nodes: ContainerLabNode[]) {
	const natIpsMap = new Map<string, string>();
	for (const node of nodes) {
		const natPublicInterface = node.natPublicInterface;
		if(natPublicInterface) {
			for (const ip of node.ips) {
				if(ip.interfaceId === natPublicInterface) {
					natIpsMap.set(node.name, ip.ip.split("/")[0]);
					break;
				}
			}
		}
	}
	return natIpsMap;
}


export function assignIPsandSubnets (nodes: DeployNode[]) {
	const subnets = new Map<string, string[]>();
	const containerlabNodes: ContainerLabNode[] = [];
	const endpoints = nodes.filter(n => n.functionalType === "WEBSERVER");
	const middleboxes = nodes.filter(n => n.functionalType !== "WEBSERVER");

	// This scenario: we have two nodes: 192.168.1.-1 and 192.168.1.1 in this order in the endpoints list. The first node will get its IP assigned
	// as 192.168.1.1 because the assignIPfromSubnet function will not see that 192.168.1.1 already exists in the subnet as it is further on 
	// the elements of the loop. To solve it I am storing the nodes that represent the subnet in the end.
	const leftoverEndpoints = [];
	for (let node of endpoints) {
		const parts = node.name.split(".");
		const subnet = findSubnet(node.name) ?? "";
		let ip = node.name;

		if (parts.some(p => p === "-1" || p === "*")) {
			leftoverEndpoints.push(node);
			continue;
		} else {
			let ips = subnets.get(subnet);
			if (ips) {
				ips.push(ip);
			}
			else {
				subnets.set(subnet, [ip]);
			}
		}

		if (node.neighbours && node.neighbours.length > 0) {
			containerlabNodes.push({
				name: node.name,
				// TO DO: Consider the use case when an endpoint is connected to more than one node
				ips: [{linkedWith: node.neighbours[0].name || "", ip: ip + "/32", interfaceId: "eth1"}],
				userDefinedName: node.configName,
			})
		}
	}

	for (let node of leftoverEndpoints) {
		const subnet = findSubnet(node.name) ?? "";
		let ip = assignIPfromSubnet(subnet, subnets).split("/")[0];

		if (node.neighbours && node.neighbours.length > 0) {
			containerlabNodes.push({
				name: node.name,
				// TO DO: Consider the use case when an endpoint is connected to more than one node
				ips: [{linkedWith: node.neighbours[0].name || "", ip: ip + "/32", interfaceId: "eth1"}],
				userDefinedName: node.configName,
			})
		}
	}

	for (let node of middleboxes) {
		if (node.neighbours) {
			let i = 1;
			const containerNode = {name: node.name, userDefinedName: node.configName, ips: [] as {linkedWith: string, ip: string, interfaceId?: string}[], natPublicInterface: undefined as string | undefined};
			for (let neigh of node.neighbours) {
				let skip = false;
				const neighbour = nodes.find(n => n.name === neigh.name);
				if (neighbour?.functionalType === "WEBSERVER") {
					let sub = findSubnet(neighbour.name) || "";
					for (let i of containerNode.ips) {
						const ipOnSubnet = subnets.get(sub)?.find(ii => ii === i.ip.split("/")[0]);
						if (ipOnSubnet) {
							containerNode.ips.push({linkedWith: neighbour.name, ip: ipOnSubnet+"/"+sub.split("/")[1], interfaceId: i.interfaceId});
							skip = true;
							break;
						}
					}
					if (skip === false) {
						const ip = assignIPfromSubnet(sub || "", subnets);
						if (ip) containerNode.ips.push({linkedWith: neighbour.name, ip: ip.replace(/\/\d+$/, "/32"), interfaceId: `eth${i++}`});
					}
				} else {
					const neighbourContainerNode = containerlabNodes.find(n => n.name === neighbour?.name);
					if (neighbourContainerNode) {
						const neighIp = neighbourContainerNode.ips.find(({linkedWith}) => linkedWith === node.name)?.ip || "";
						let subnet;
						for (const [key, ips] of subnets.entries()) {
							if(ips.includes(neighIp.split("/")[0])) {
								subnet = key;
								break;
							}
						}
						const ip = assignIPfromSubnet(subnet || "", subnets);
						if (ip) containerNode.ips.push({linkedWith: neighbour?.name || "", ip, interfaceId: `eth${i++}`});	
					} else {
						const ip = assignIPfromSubnet(`${router_ip}/30`, subnets);
						if (ip) containerNode.ips.push({linkedWith: neighbour?.name || "", ip, interfaceId: `eth${i++}`});
						router_ip = intToIP(ipToInt(router_ip) + 4);
							
					}
				}
			}
			if (node.functionalType === "NAT" && node.natAddresses && node.natAddresses.length > 0) {
				for (let ip of containerNode.ips) {
					if (!node.natAddresses.includes(ip.linkedWith)) {
						containerNode.natPublicInterface = ip.interfaceId;
						break;
					}
				}
			}
					
			containerlabNodes.push(containerNode);
		}
	}

	console.log("Container lab nodes");
	console.dir(containerlabNodes, { depth: null });
	console.log("Subnets");
	console.log(subnets);

	return { containerlabNodes, subnets };
}

export function bfs(nodes: DeployNode[], rootName: string) {
	const queue = new Queue<[string, string]>();
	const visited = new Set<string>();
	const paths: [string, string][] = [];
	const rootNode = nodes.find((n) => n.name === rootName);
	visited.add(rootName);

	if (!rootNode?.neighbours) return;

	for (const neighbour of rootNode?.neighbours) {
		queue.enqueue([neighbour.name, neighbour.name]);
		visited.add(neighbour.name);
		paths.push([neighbour.name, neighbour.name])
	}

	while (!queue.isEmpty()) {
		const node = queue.dequeue();
		if (!node) break;
		const nextNode = nodes.find((n) => n.name === node[0]);
		if (!nextNode) break;

		if (nextNode.neighbours) {
			for (const neighbour of nextNode.neighbours) {
				if (!visited.has(neighbour.name.split("/")[0])) {
					queue.enqueue([neighbour.name, node[1]]);
					visited.add(neighbour.name);
					paths.push([neighbour.name, node[1]])
				}
			}
		}	
	}   

	if(visited.size < nodes.length) {
		throw new Error("The graph is not connected");
	}
	console.log("paths");
	console.dir(paths, { depth: null });
	return paths;
}


export function mapPathsToRoutes(paths: [string, string][], rootName: string, containerlabNodes: ContainerLabNode[], subnets: Map<string, string[]>) {
	const routes: {to: string, via: string}[] = [];
	const visitedDestinations = new Set<string>();
	for (const [pathTo, pathVia] of paths) {
		if (pathTo === pathVia) continue;

		const node = containerlabNodes.find((n) => n.name === rootName);
		const viaInterface = containerlabNodes.find((n) => n.name === pathVia)?.ips.find(({linkedWith, }) => linkedWith === node?.name)?.ip;
		for (const {ip} of containerlabNodes.find(n => n.name === pathTo)?.ips || []) {
			const destination = `${ip.split("/")[0]}/32`;
			if (visitedDestinations.has(destination)) continue;

			const isLocal = (node?.ips || []).some(({ip: localIp}) => localIp.split("/")[0] === ip.split("/")[0]);
			if (!isLocal) {
				routes.push({to: destination, via: viaInterface || ""});
				visitedDestinations.add(destination);
			}
		}
	}
	console.log("ROUTES")
	console.log(routes);

	return routes;
}


function sanitizeNodeName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}


export function configureLinks(containerlabNodes: ContainerLabNode[]) {
	const endpoints: [string, string][] = [];
	const seen = new Set<string>();

	for (const node of containerlabNodes) {
		for (const ipEntry of node.ips) {
			const peerNode = containerlabNodes.find((candidate) => candidate.name === ipEntry.linkedWith);
			if (!peerNode) continue;

			const peerInterface = peerNode.ips.find((candidate) => candidate.linkedWith === node.name);
			if (!peerInterface) continue;

			const nodeEndpoint = `${sanitizeNodeName(node.userDefinedName ?? node.name)}:${ipEntry.interfaceId ?? "eth1"}`;
			const peerEndpoint = `${sanitizeNodeName(peerNode.userDefinedName ?? peerNode.name)}:${peerInterface.interfaceId ?? "eth1"}`;
			const key = [nodeEndpoint, peerEndpoint].sort().join("::");

			if (!seen.has(key)) {
				seen.add(key);
				endpoints.push([nodeEndpoint, peerEndpoint]);
			}
		}
	}

	console.log(endpoints);
	return endpoints;
}
