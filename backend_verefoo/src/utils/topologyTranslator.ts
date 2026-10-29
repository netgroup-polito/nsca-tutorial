import { XMLParser } from "fast-xml-parser";
import XMLBuilder from "fast-xml-builder";
import * as yaml from "js-yaml";
import { AllocationType, NodeType, Protocol, VerefooAllocationType, VerefooLinkMetrics, VerefooNode, VerefooTopology, VerefooProperty, DeployNode } from "./types";
import { readFileSync } from "fs";
import { join } from "path";
import { assignIPsandSubnets, bfs, configureLinks, mapPathsToRoutes, natInternalToUserIpTranslate } from "./deploy";

const TEMPLATE_PATH = join(__dirname, "../templates");

export type BuildXMLOptions = {
  includeNodes?: boolean;
  includeProperties?: boolean;
  includeLayout?: boolean;
  reactSuitable?: boolean;
};

export function buildVerefooXML(topology: VerefooTopology, options: BuildXMLOptions = {}): string {
  const { includeNodes = true, includeProperties = true, includeLayout = false, reactSuitable = false } = options;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (tagName) => ["node", "neighbour", "AllocationConstraint", "LinkMetrics", "Property"].includes(tagName),
  });

  const template = readFileSync(join(TEMPLATE_PATH, "VerefooTemplate.xml"));
  const parsed = parser.parse(template);

  const nfv = parsed.NFV;

  if (includeNodes) {
    nfv.graphs = {
      graph: {
        "@_nodes_saved": "True",
        "@_id": topology.graphId || 0,
        "@_serviceGraph": topology.serviceGraph ? "true" : "false",
        ...(reactSuitable && {"@_reactSuitable": "true"}),
        node: topology.nodes.map((node) => ({
          ...(node.functional_type !== "" && {"@_functional_type": node.functional_type}),
          "@_name": node.name,
          ...(includeLayout && {
            "@_x": node.x,
            "@_y": node.y,
            "@_width": node.width,
            "@_height": node.height,
            "@_resultingWidth": node.resultingWidth,
            "@_resultingHeight": node.resultingHeight,
          }),
          neighbour: node.neighbours?.map((nb) => ({ "@_name": nb.name })),
          ...(node.functional_type !== "" && {configuration: node.configName
            ? {
                "@_description": node.configDescription,
                "@_name": node.configName,
                ...(node.functional_type === "WEBSERVER" && {"webserver": {"name": node.name}}),
                ...(node.functional_type === "NAT" && node.natAddresses) && {"nat": {"source": node.natAddresses}},
                ...(node.functional_type === "LOADBALANCER") && {"loadbalancer": {"pool": node.loadBalancerPool}},
                ...(node.functional_type === "FORWARDER" && {"forwarder": {"name": "Forwarder"}}),
                ...(node.functional_type === "TRAFFIC_MONITOR" && {"forwarder": {"name": "Traffic Monitor"}}),
                ...(node.functional_type === "FIREWALL" && {"firewall": {"@_defaultAction": node.firewall?.defaultAction,
                  elements: node.firewall?.elements.map((e) => ({
                    "action": e.action,
                    "source": e.source,
                    "destination": e.destination,
                    "protocol": e.protocol,
                    "src_port": e.src_port,
                    "dst_port": e.dst_port,
                  }))
                }})
              }
            : undefined,})
        })),
      }
    };

    // --- AllocationConstraints ---
    nfv.Constraints.AllocationConstraints = {
      AllocationConstraint: topology.allocationConstraints.map((ac) => ({
        "@_type": ac.type,
        "@_nodeA": ac.nodeA,
        "@_nodeB": ac.nodeB,
      })),
    };

    // --- LinkConstraints ---
    nfv.Constraints.LinkConstraints = {
      LinkMetrics: topology.linkMetrics.map((lm) => ({
        "@_src": lm.src,
        "@_dst": lm.dst,
        "@_reqLatency": lm.reqLatency,
      })),
    };
  }

  if (includeProperties) {
    // --- PropertyDefinition ---
    nfv.PropertyDefinition = {
      "@_requirements_saved": "True", 
      Property: topology.properties.map((prop) => ({
        "@_graph": prop.graph,
        "@_name": prop.name,
        ...(prop.src && { "@_src": prop.src }),
        ...(prop.dst && { "@_dst": prop.dst }),
        ...(prop.src_port && { "@_src_port": prop.src_port }),
        ...(prop.dst_port && { "@_dst_port": prop.dst_port }),
        ...(prop.lv4proto && { "@_lv4proto": prop.lv4proto }),
        ...(prop.isSat !== undefined && { "@_isSat": prop.isSat ? "true" : "false"}),
      })),
    };

    if (topology.initialProperties) {
      nfv.InitialProperty = {
      Property: topology.initialProperties.map((prop) => ({
        "@_graph": prop.graph,
        "@_name": prop.name,
        ...(prop.src && { "@_src": prop.src }),
        ...(prop.dst && { "@_dst": prop.dst }),
        ...(prop.src_port && { "@_src_port": prop.src_port }),
        ...(prop.dst_port && { "@_dst_port": prop.dst_port }),
        ...(prop.lv4proto && { "@_lv4proto": prop.lv4proto }),
        ...(prop.isSat !== undefined && { "@_isSat": prop.isSat ? "true" : "false"}),
      })),        
      }
    }

  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
    indentBy: "    ",
    suppressEmptyNode: true,
  });

  return builder.build(parsed);
}

export function buildCanvasObj(xml: string): VerefooTopology {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (tagName) =>
      ["node", "neighbour", "AllocationConstraint", "LinkMetrics", "Property", "elements"].includes(tagName),
  });

  const parsed = parser.parse(xml);
  const nfv = parsed.NFV;
  const serviceGraph = nfv.graphs?.graph?.["@_serviceGraph"];
  const reactSuitable = nfv.graphs?.graph?.["@_reactSuitable"] ?? false;
  const nodesSaved = nfv.graphs?.graph?.["@_nodes_saved"] ? true : false;
  const requirementsSaved = nfv.PropertyDefinition?.["@_requirements_saved"] ? true : false;
  const graphNodes = nfv.graphs?.graph?.node ?? [];

  // --- Nodes ---
  const nodes: VerefooNode[] = graphNodes.map((n: any, index: number) => {
    const firewallDef = n.configuration?.firewall;
    const natDef = n.configuration?.nat;
    const loadBalancerDef = n.configuration?.loadbalancer;

    return {
      id: Number(n["@_id"] ?? index + 1),
      name: n["@_name"] ?? "",
      functional_type: n["@_functional_type"] as NodeType,
      configName: n.configuration?.["@_name"] ?? "",
      configDescription: n.configuration?.["@_description"] ?? "",
      x: n["@_x"] !== undefined ? Number(n["@_x"]) : undefined,
      y: n["@_y"] !== undefined ? Number(n["@_y"]) : undefined,
      width: n["@_width"] !== undefined ? Number(n["@_width"]) : undefined,
      height: n["@_height"] !== undefined ? Number(n["@_height"]) : undefined,
      resultingWidth: n["@_resultingWidth"] !== undefined ? Number(n["@_resultingWidth"]) : undefined,
      resultingHeight: n["@_resultingHeight"] !== undefined ? Number(n["@_resultingHeight"]) : undefined,
      neighbours: (n.neighbour ?? []).map((neighbour: any) => {
        return {id: neighbour["@_id"], name: neighbour["@_name"]}
      }),
      ...(firewallDef && {
        firewall: {
          defaultAction: firewallDef["@_defaultAction"] ?? "ALLOW",
          elements: (firewallDef.elements ?? []).map((el: any) => ({
            action: el.action ?? "",
            source: el.source ?? "",
            destination: el.destination ?? "",
            protocol: el.protocol ?? "",
            src_port: String(el.src_port ?? ""),
            dst_port: String(el.dst_port ?? ""),
          })),
        },
      }),
      ...(natDef && {
        natAddresses: Array.isArray(natDef.source) ? natDef.source : [natDef.source]
      }),
      ...(loadBalancerDef && {
        loadBalancerPool: Array.isArray(loadBalancerDef.pool) ? loadBalancerDef.pool : [loadBalancerDef.pool]
      })
    };
  });

  // --- Requirements (Properties) ---
  const graphProperties: any[] = nfv.PropertyDefinition?.Property ?? [];

  const properties: VerefooProperty[] = graphProperties.map((p: any, index: number) => ({
    graph: p.graph,
    id: index + 1,
    src: p["@_src"] ?? "",
    dst: p["@_dst"] ?? "",
    src_port: p["@_src_port"] ?? "",
    dst_port: p["@_dst_port"] ?? "",
    lv4proto: (p["@_lv4proto"] ?? "ANY") as Protocol,
    name: (p["@_name"] ?? "IsolationProperty"),
    isSat: p["@_isSat"] === undefined ? undefined : p["@_isSat"] === "true" ? true : false,
  }));

  // --- Allocation Constraints ---
  const rawAC: any[] = nfv.Constraints?.AllocationConstraints?.AllocationConstraint ?? [];

  const allocationConstraints: VerefooAllocationType[] = rawAC.map(
    (ac: any, index: number) => ({
      id: index + 1,
      nodeA: ac["@_nodeA"],
      nodeB: ac["@_nodeB"],
      type: ac["@_type"] as AllocationType,
    })
  );

  // --- Link Constraints ---
  const rawLM: any[] = nfv.Constraints?.LinkConstraints?.LinkMetrics ?? [];

  const linkMetrics: VerefooLinkMetrics[] = rawLM.map(
    (lm: any, index: number) => ({
      id: index + 1,
      src: lm["@_src"],
      dst: lm["@_dst"],
      reqLatency: String(lm["@_reqLatency"] ?? ""),
    })
  );

  return { serviceGraph, reactSuitable, nodes, properties, allocationConstraints, linkMetrics, nodesSaved, requirementsSaved };
}


// -------------------------------------- Building CLAB Topology ----------------

export function sanitizeNodeName(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function installNetcatIfMissing(): string {
  return [
    "if command -v nc >/dev/null 2>&1; then",
    "  echo 'nc already installed';",
    "elif command -v apk >/dev/null 2>&1; then",
    "  apk add --no-cache netcat-openbsd",
    "elif command -v apt-get >/dev/null 2>&1; then",
    "  apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y netcat-openbsd",
    "else",
    "  echo 'No supported package manager found to install nc' >&2",
    "  exit 1",
    "fi"
  ].join("; ");
}

export function buildFirewallExec(firewall: { defaultAction: string; elements: { action: string; source: string; destination: string; protocol: string; src_port: string; dst_port: string }[] }, natIpsMap: Map<string, string>): string[] {
    const exec: string[] = [];
    const defaultTarget = firewall.defaultAction === "DENY" ? "DROP" : "ACCEPT";

    const formatPort = (port: string): string | null => {
        if (!port || port === "*" || port === "0-65535") return null;
        return port.includes("-") ? port.replace("-", ":") : port;
    };

    exec.push(`iptables -P FORWARD ${defaultTarget}`);
    exec.push("iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT");

    for (const rule of firewall.elements) {
        const target = rule.action === "DENY" ? "DROP" : "ACCEPT";
        let base = "iptables -A FORWARD";

        const source = natIpsMap.get(rule.source) ?? rule.source;
        const destination = natIpsMap.get(rule.destination) ?? rule.destination;

        if (rule.source && rule.source !== "-1") base += ` -s ${source}`;
        if (rule.destination && rule.destination !== "-1") base += ` -d ${destination}`;

        const proto = rule.protocol?.toLowerCase();
        const sPort = formatPort(rule.src_port);
        const dPort = formatPort(rule.dst_port);

        let protos: (string | null)[];
        if (proto === "tcp" || proto === "udp") {
            protos = [proto];
        } else if (sPort || dPort) {
            protos = ["tcp", "udp"];
        } else {
            protos = [null];
        }

        for (const p of protos) {
            let cmd = base;
            if (p) {
                cmd += ` -p ${p}`;
                if (sPort) cmd += ` --sport ${sPort}`;
                if (dPort) cmd += ` --dport ${dPort}`;
            }
            exec.push(`${cmd} -j ${target}`);
        }
    }

    return exec;
}

export default function buildClabYaml(deployNodes: DeployNode[], labName = "verefoo-lab"): string {
  const { containerlabNodes, subnets } = assignIPsandSubnets(deployNodes);

  const clabNodes: Record<string, { kind: string; image?: string; exec?: string[] }> = {};
  const natIpsMap = natInternalToUserIpTranslate(containerlabNodes);
  for (const node of containerlabNodes) {
    const safeName = sanitizeNodeName(node.userDefinedName ?? node.name);
    const isRouter = node.ips.length > 1;
    const deployNode = deployNodes.find(d => d.name === node.name);
    const isFirewall = deployNode?.functionalType === "FIREWALL";
    const isNAT = deployNode?.functionalType === "NAT";

    const exec: string[] = [installNetcatIfMissing()];

    for (const { ip, interfaceId } of node.ips) {
      exec.push(`ip addr add ${ip} dev ${interfaceId}`);
      const peer = deployNodes.find((candidate) => candidate.name === node.ips.find((entry) => entry.interfaceId === interfaceId)?.linkedWith);
      if (isRouter && peer?.functionalType === "WEBSERVER") {
        const peerIp = containerlabNodes.find((candidate) => candidate.name === peer.name)?.ips.find((entry) => entry.linkedWith === node.name)?.ip.split("/")[0];
        if (peerIp) exec.push(`ip route add ${peerIp}/32 dev ${interfaceId}`);
      }
    }

    if (isRouter) {
      exec.unshift("sysctl -w net.ipv4.ip_forward=1");
      try {
        const paths = bfs(deployNodes, node.name);
        if (paths) {
          const routes = mapPathsToRoutes(paths, node.name, containerlabNodes, subnets);
          for (const { to, via } of routes) {
              if (via) exec.push(`ip route add ${to} via ${via.split("/")[0]}`);
          }
        }
      } catch (err) {
        throw err;
      }
    } else {
      const gatewayEntry = node.ips[0];
      const gatewayNode = containerlabNodes.find(n => n.name === gatewayEntry?.linkedWith);
      const gatewayIface = gatewayNode?.ips.find(({ linkedWith }) => linkedWith === node.name);
      const gatewayIp = gatewayIface?.ip.split("/")[0];
      if (gatewayIp) {
        exec.push(`ip route add ${gatewayIp}/32 dev ${gatewayEntry.interfaceId}`);
        exec.push(`ip route add default via ${gatewayIp}`);
      }
    }

    if (isFirewall && deployNode?.firewall) {
      exec.push(...buildFirewallExec(deployNode.firewall, natIpsMap));
    }

    if (isNAT && node.natPublicInterface) {
      exec.push(`iptables -t nat -A POSTROUTING -o ${node.natPublicInterface} -j MASQUERADE`)
    }

    clabNodes[safeName] = {
      kind: "linux",
      image: isRouter ? "frrouting/frr:latest" : "nicolaka/netshoot:latest",
      exec,
    };
  }

  const links = configureLinks(containerlabNodes).map(([a, b]) => ({ endpoints: [a, b] }));

  return yaml.dump({ name: labName, topology: { defaults: {"network-mode": "none"}, nodes: clabNodes, links } }, { lineWidth: -1 });
}