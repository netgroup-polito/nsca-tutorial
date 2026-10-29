import { NodeType, EdgeType, NetworkNode, Topology, VerefooNode, Neighbour, VerefooAllocationType, AllocationConstraintType, LinkConstraintType, VerefooLinkMetrics, RequirementType, VerefooProperty, VerefooTopology, AllocationType, FirewallConfigurationType, Action, VerefooFirewallConfig, VerefooFirewallRule, DeployNode } from "./types";

//-----------------------MAP-TO-VEREFOO-----------------------//

const functional_type_mapper = {
  "EndPoint": "WEBSERVER",
  "AllocationPlace": "",
  "NAT": "NAT",
  "LoadBalancer": "LOADBALANCER",
  "Firewall": "FIREWALL",
  "Forwarder": "FORWARDER",
  "TrafficMonitor": "TRAFFIC_MONITOR"
}

const reverse_functional_type_mapper = Object.fromEntries(
  Object.entries(functional_type_mapper).map(([k, v]) => [v, k])
) as Record<string, string>;

function mapToVerefooNodes(nodes: NetworkNode[], edges: EdgeType[], firewallConfigurations: FirewallConfigurationType[]): {serviceGraph: boolean, verefooNodes: VerefooNode[]} {
  let verefooNodes: VerefooNode[] = [];
  let serviceGraph = true;
 
  for (let node of nodes) {
    let neighbours: Neighbour[] = [];
    if(node.type === "AllocationPlace" || node.type === "Firewall" || node.type === "Forwarder") {
      serviceGraph = false;
    }
    for (let edge of edges) {
      if (edge.nodeFrom === node.id) {
        neighbours.push({name: nodes.find(n => n.id === edge.nodeTo)?.ip || ""})
      }
      if (edge.nodeTo === node.id) {
        neighbours.push({name: nodes.find(n => n.id === edge.nodeFrom)?.ip || ""})
      }
    }
    const firewall: VerefooFirewallConfig = {defaultAction: "DENY", elements: []};
    if (node.type === "Firewall" && firewallConfigurations) {
      let correspondingFirewall = firewallConfigurations.find((c) => c.id === node.id);
      firewall.defaultAction = correspondingFirewall?.default.toUpperCase() ?? "DENY";
      const elements: VerefooFirewallRule[] = correspondingFirewall?.config.map((c) => { return {
        action: c.action.toUpperCase(),
        source: c.sourceIP,
        destination: c.destIP,
        src_port: c.sourcePort,
        dst_port: c.destPort,
        protocol: c.protocol
      }}) || [];
      firewall.elements = elements;
    }
    let verefooNode = {
      functional_type: functional_type_mapper[node.type],
      name: node.ip,
      configDescription: node.description,
      configName: node.name,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      neighbours: neighbours,
      ...(node.natAddresses && { natAddresses: node.natAddresses }),
      ...(node.loadBalancerPool && { loadBalancerPool: node.loadBalancerPool }),
      ...(node.resultingWidth && { resultingWidth: node.resultingWidth}),
      ...(node.resultingHeight && { resultingHeight: node.resultingHeight}),
      ...(node.type === "Firewall" && {firewall} )
    }
    verefooNodes.push(verefooNode);
  }

  return {serviceGraph, verefooNodes};
}

function mapToVerefooAllocationConstraints(allocationConstraints: AllocationConstraintType[], nodes: NetworkNode[]): VerefooAllocationType[] {
  let verefooAllocationConstraints: VerefooAllocationType[] = allocationConstraints.map(a => ({
    nodeA: nodes.find(n => n.id === a.nodeA)?.ip || "", 
    nodeB: nodes.find(n => n.id === a.nodeB)?.ip || "", 
    type: a.type.toLowerCase()
  }));

  return verefooAllocationConstraints;
}

function mapToVerefooLinkMetrics(linkConstraints: LinkConstraintType[], nodes: NetworkNode[]): VerefooLinkMetrics[] {
  let verefooLinkMetrics: VerefooLinkMetrics[] = [];

  for (let linkConstraint of linkConstraints) {
    let sourceName;
    let destName;
    for (let node of nodes) {
      if (node.id === linkConstraint.source) sourceName = node.ip;
      else if(node.id === linkConstraint.destination) destName = node.ip;
    }
    verefooLinkMetrics.push({src: sourceName || "", dst: destName || "", reqLatency: linkConstraint.requestLatency})
  }

  return verefooLinkMetrics;
}

function mapToVerefooProperties(requirements: RequirementType[], graphId: number): VerefooProperty[] {
  let verefooProperties: VerefooProperty[] = [];

  for(let req of requirements) {
    const sourceIP = req.sourceIP.replaceAll("*", "-1");
    const destIP = req.destIP.replaceAll("*", "-1");
    const sourcePort = req.sourcePort.trim() === "*" ? "0-65535" : req.sourcePort;
    const destPort = req.destPort.trim() === "*" ? "0-65535" : req.destPort;
    verefooProperties.push({
      graph: graphId, 
      name: req.action==="Allow" ? "ReachabilityProperty" : "IsolationProperty", 
      src: sourceIP, 
      dst: destIP, 
      src_port: sourcePort, 
      dst_port: destPort, 
      lv4proto: req.protocol,
      ...(req.isSat !== undefined && {isSat: req.isSat}),
    })
  }

  return verefooProperties;
}

export function mapToVerefoo({nodes, edges, requirements, allocationConstraints, linkConstraints, firewallConfigurations, initialRequirements }: Topology, graphId: number): VerefooTopology {
  let {serviceGraph, verefooNodes}: {serviceGraph:boolean, verefooNodes: VerefooNode[]} = mapToVerefooNodes(nodes, edges, firewallConfigurations);
  let verefooProperties: VerefooProperty[] = mapToVerefooProperties(requirements, graphId);
  let verefooAllocationConstraints: VerefooAllocationType[] = allocationConstraints ? mapToVerefooAllocationConstraints(allocationConstraints, nodes) : [];
  let verefooLinkMetrics: VerefooLinkMetrics[] = linkConstraints ? mapToVerefooLinkMetrics(linkConstraints, nodes) : [];
  let verefooInitialProperties: VerefooProperty[] | null = initialRequirements ? mapToVerefooProperties(initialRequirements, graphId) : null;
  return {
    serviceGraph,
    nodes: verefooNodes,
    properties: verefooProperties,
    allocationConstraints: verefooAllocationConstraints,
    linkMetrics: verefooLinkMetrics,
    graphId,
    ...(verefooInitialProperties && {initialProperties: verefooInitialProperties})
  } as VerefooTopology
}

//-----------------------MAP-TO-CANVAS-----------------------//

function mapToCanvasNodesEdges(nodes: VerefooNode[], nameToId: Map<string, number|undefined>): {canvasNodes: NetworkNode[], canvasEdges: EdgeType[]} { 
  const canvasNodes: NetworkNode[] = [];
  const canvasEdges: EdgeType[] = [];
  for (let node of nodes) {
    canvasNodes.push({
      id: node.id ?? 0,
      name: node.configName,
      type: (reverse_functional_type_mapper[node.functional_type] ?? "AllocationPlace") as NodeType,
      ip: node.name,
      description: node.configDescription,
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 47,
      height: node.height ?? 47,
      resultingWidth: node.resultingWidth,
      resultingHeight: node.resultingHeight,
      ...(node.firewallId !== undefined && {firewallId: node.firewallId}),
      ...(node.natAddresses && {natAddresses: node.natAddresses}),
      ...(node.loadBalancerPool && {loadBalancerPool: node.loadBalancerPool}),
    })
    if(node.neighbours) {
      for (let neighbour of node.neighbours) {
        const nodeId = nameToId.get(node.name);
        const neighborId = nameToId.get(neighbour.name);
        
        if(canvasEdges.filter((e) => (e.nodeFrom === nodeId && e.nodeTo === neighborId) || (e.nodeFrom === neighborId && e.nodeTo === nodeId)).length === 0) {
          canvasEdges.push({nodeFrom: nodeId ?? 0, nodeTo: neighborId ?? 0});
        }
      }
    }
  }
  
  return { canvasNodes, canvasEdges };
}

function mapToCanvasRequirements(properties: VerefooProperty[]): RequirementType[] {
  const canvasRequirements: RequirementType[] = [];

  for (let property of properties) {
    canvasRequirements.push({ id: property.id ?? 0, sourceIP: property.src ?? "", destIP: property.dst ?? "", sourcePort: property.src_port ?? "", destPort: property.dst_port ?? "", protocol:property.lv4proto ?? "ANY",  action: property.name === "ReachabilityProperty" ? "Allow" : "Deny", isSat: property.isSat })
  }

  return canvasRequirements;
}

function mapToCanvasAllocationConstraints(allocationConstraints: VerefooAllocationType[], nameToId: Map<string, number | undefined>): AllocationConstraintType[] {
  const canvasAllocationConstraints: AllocationConstraintType[] = [];

  for (let allocationConstraint of allocationConstraints) {
    const normalizedType = allocationConstraint.type.charAt(0).toUpperCase() + allocationConstraint.type.slice(1).toLowerCase();
    canvasAllocationConstraints.push({ nodeA: nameToId.get(allocationConstraint.nodeA) ?? 0, nodeB: nameToId.get(allocationConstraint.nodeB) ?? 0, type: normalizedType as AllocationType })
  }
  return canvasAllocationConstraints;
}

function mapToCanvasLinkConstraints(linkMetrics: VerefooLinkMetrics[], nameToId: Map<string, number | undefined>): LinkConstraintType[] {
  const canvasLinkConstraints: LinkConstraintType[] = [];

  for (let linkMetric of linkMetrics) {
    canvasLinkConstraints.push({ source: nameToId.get(linkMetric.src) ?? 0, destination: nameToId.get(linkMetric.dst) ?? 0, requestLatency: linkMetric.reqLatency})
  }
  return canvasLinkConstraints;
}

function mapToCanvasFirewallConfigurations(nodes: VerefooNode[]): FirewallConfigurationType[] {
  const canvasFirewallConfigurations: FirewallConfigurationType[] = [];

  for (let node of nodes) {
    if (!node.firewall) continue;

    const config: RequirementType[] = node.firewall.elements.map((el, index) => ({
      id: index + 1,
      sourceIP: el.source,
      destIP: el.destination,
      sourcePort: el.src_port,
      destPort: el.dst_port,
      protocol: (el.protocol || "ANY") as RequirementType["protocol"],
      action: (el.action === "DENY" ? "Deny" : "Allow") as Action,
    }));

    canvasFirewallConfigurations.push({
      id: node.id ?? 0,
      ip: node.name,
      config,
      default: node.firewall.defaultAction === "DENY" ? "Deny" : "Allow",
    });
  }

  return canvasFirewallConfigurations;
}

export function mapToCanvas({nodes, properties, allocationConstraints, linkMetrics, reactSuitable, nodesSaved, requirementsSaved }: VerefooTopology): Topology {
  const nameToId = new Map(nodes.map((n) => [n.name, n.id]));
  let {canvasNodes, canvasEdges} = mapToCanvasNodesEdges(nodes, nameToId);
  let canvasAllocationConstraints = mapToCanvasAllocationConstraints(allocationConstraints, nameToId);
  let canvasLinkConstraints = mapToCanvasLinkConstraints(linkMetrics, nameToId);
  let canvasRequirements = mapToCanvasRequirements(properties);
  let canvasFirewallConfigurations = mapToCanvasFirewallConfigurations(nodes);

  return {
    nodes: canvasNodes,
    edges: canvasEdges,
    allocationConstraints: canvasAllocationConstraints,
    linkConstraints: canvasLinkConstraints,
    requirements: canvasRequirements,
    firewallConfigurations: canvasFirewallConfigurations,
    reactSuitable: reactSuitable,
    nodesSaved: nodesSaved,
    requirementsSaved: requirementsSaved,
  }

}


// ------------------- MAP TO CONTAINERLAB DEPLOY ----------------------------//

function mapToDeployNodes(nodes: NetworkNode[], edges: EdgeType[], firewallConfigurations: FirewallConfigurationType[]): DeployNode[] {
  let deployNodes: DeployNode[] = [];

  for (let node of nodes) {
    let neighbours: Neighbour[] = [];
    for (let edge of edges) {
      if (edge.nodeFrom === node.id) {
        neighbours.push({name: nodes.find(n => n.id === edge.nodeTo)?.ip || ""})
      }
      if (edge.nodeTo === node.id) {
        neighbours.push({name: nodes.find(n => n.id === edge.nodeFrom)?.ip || ""})
      }
    }

    let firewall: VerefooFirewallConfig | undefined;
    if (node.type === "Firewall") {
      const correspondingFirewall = firewallConfigurations.find((c) => c.id === node.id);
      if (correspondingFirewall) {
        firewall = {
          defaultAction: correspondingFirewall.default.toUpperCase(),
          elements: correspondingFirewall.config.map((c) => ({
            action: c.action.toUpperCase(),
            source: c.sourceIP,
            destination: c.destIP,
            src_port: c.sourcePort,
            dst_port: c.destPort,
            protocol: c.protocol
          }))
        };
      }
    }
    const natAddresses = node.natAddresses;
  
    let deployNode = {
      functionalType: functional_type_mapper[node.type],
      name: node.ip,
      configName: node.name,
      neighbours: neighbours,
      firewall: firewall,
      natAddresses: natAddresses,
    }
    deployNodes.push(deployNode);
  }

  return deployNodes;
}

export function mapToContainerLab({nodes, edges, firewallConfigurations }: {nodes: NetworkNode[], edges: EdgeType[], firewallConfigurations: FirewallConfigurationType[]}): DeployNode[] {
  let deployNodes: DeployNode[] = mapToDeployNodes(nodes, edges, firewallConfigurations);
  return deployNodes;
}

