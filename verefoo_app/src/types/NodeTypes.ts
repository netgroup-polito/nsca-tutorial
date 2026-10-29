export type NodeType = "EndPoint" | "NAT" | "LoadBalancer" | "Firewall" | "AllocationPlace" | "Forwarder" | "TrafficMonitor";
export type Protocol = "TCP" | "UDP" | "ANY" | "OTHER";
export type Action = "Deny" | "Allow"


export type NetworkNode = {
    id: number,
    name: string,
    type: NodeType,
    x: number,
    y: number,
    width: number,
    height: number,
    ip: string,
    natAddresses?: string[],
    loadBalancerPool?: string[],
    description?: string,
    error?: boolean,
    updated?: boolean,
    firewallId?: number,
    resultingWidth?: number,
    resultingHeight?: number,
};


export type DragItem =
  | { type: NodeType; kind: "new" }
  | { id: number; kind: "existing" };


export type Edge = {
    nodeFrom: number,
    nodeTo: number,
} 


export type Requirement = {
    id: number,
    sourceIP: string,
    destIP: string,
    sourcePort: string,
    destPort: string,
    protocol:  Protocol,
    action: Action,
    isSat?: boolean
}

export type FirewallConfiguration = {
    id: number,
    ip?: string,
    config: Requirement[],
    default: Action
}