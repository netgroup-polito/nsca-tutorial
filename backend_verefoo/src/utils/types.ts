export type Protocol = "TCP" | "UDP" | "ANY" | "OTHER";
export type Action = "Deny" | "Allow";
export type AllocationType = "Forced" | "Forbidden";
export type NodeType = "EndPoint" | "NAT" | "LoadBalancer" | "Firewall" | "AllocationPlace" | "Forwarder" | "TrafficMonitor";
export type PropertyName = "ReachabilityProperty" | "IsolationProperty"
export type FirewallType = "iptables" | "fortinet" | "openvswitch" | "ipfw"

export type NetworkNode = {
  id: number,
  name: string,
  type: NodeType,
  x?: number,
  y?: number,
  width?: number,
  height?: number,
  natAddresses?: string[],
  loadBalancerPool?: string[],
  ip: string,
  description: string,
  firewallId?: number,
  resultingWidth?: number,
  resultingHeight?: number,
}

export type EdgeType = {
    nodeFrom: number,
    nodeTo: number,
}

export type RequirementType = {
    id: number,
    sourceIP: string,
    destIP: string,
    sourcePort: string,
    destPort: string,
    protocol:  Protocol,
    action: Action
    isSat? : boolean
}

export type AllocationConstraintType = {
    id?: number;
    nodeA: number;
    nodeB: number;
    type: AllocationType;
}

export type LinkConstraintType = {
    id?: number;
    source: number;
    destination: number;
    requestLatency: string;
}

export type Topology = {
    nodes: NetworkNode[],
    edges: EdgeType[],
    requirements: RequirementType[],
    allocationConstraints: AllocationConstraintType[],
    linkConstraints: LinkConstraintType[],
    firewallConfigurations: FirewallConfigurationType[],
    selectedAlgorithm?: "AP" | "MF",
    initialRequirements?: RequirementType[],
    reactSuitable?: boolean,
    nodesSaved?: boolean,
    requirementsSaved?: boolean, 
}

export type FirewallConfigurationType = {
    id: number;
    ip: string;
    config: RequirementType[];
    default: Action;
}


// ---- BACKEND TYPES -------------------------------------------------------------
export type Neighbour = {
  id?: string;
  name: string; 
}

export type VerefooFirewallRule = {
  action: string;
  source: string;
  destination: string;
  protocol: string;
  src_port: string;
  dst_port: string;
}

export type VerefooFirewallConfig = {
  defaultAction: string;
  elements: VerefooFirewallRule[];
}

export type VerefooNode = {
  id?: number,
  functional_type: string;
  name: string;
  configDescription: string;
  configName: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  neighbours: Neighbour[] | null;
  firewall?: VerefooFirewallConfig;
  natAddresses?: string[];
  loadBalancerPool?: string[];
  firewallId?: number;
  resultingWidth?: number;
  resultingHeight?: number;
}

export type VerefooAllocationType = {
  id?: number;
  type: string; 
  nodeB: string; 
  nodeA: string;
}

export type VerefooLinkMetrics = {
  id?: number;
  src: string;
  dst: string;
  reqLatency: string;
}

export type VerefooProperty = {
  id?: number,
  graph: number;
  name: PropertyName;
  src?: string;
  dst?: string;
  src_port?: string;
  dst_port?: string;
  lv4proto?: Protocol;
  isSat?: boolean;
}

export type VerefooTopology = {
  serviceGraph: boolean,
  reactSuitable?: boolean,
  nodes: VerefooNode[],
  properties: VerefooProperty[],
  allocationConstraints: VerefooAllocationType[],
  linkMetrics: VerefooLinkMetrics[],
  graphId?: number,
  initialProperties?: VerefooProperty[],
  nodesSaved?: boolean,
  requirementsSaved?: boolean,
}


// --- CONTAINER LAB EXPERIMENT -----------------------------------------
export type DeployNode = {
  functionalType: string;
  configName: string;
  name: string;
  neighbours: Neighbour[] | null;
  firewall?: VerefooFirewallConfig;
  natAddresses?: string[];
}

export type ContainerLabNode = {
  name: string,
  ips: {linkedWith: string, ip: string, interfaceId?: string}[],
  routes?: {to: string, via: string}[], 
  userDefinedName?: string,
  natPublicInterface?: string,
}

export type ClabTopology = {
    name: string;
    topology: {
        nodes: Record<string, {
            kind: string;
            image: string;
            exec?: string[];
        }>;
        links: { endpoints: [string, string] }[];
    };
}