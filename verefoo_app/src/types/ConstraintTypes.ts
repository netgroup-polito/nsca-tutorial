export type AllocationType = "Forced" | "Forbidden";

export type AllocationConstraint = {
    id: number;
    nodeA: number;
    nodeB: number;
    type: AllocationType;
}

export type LinkConstraint = {
    id: number;
    source: number;
    destination: number;
    requestLatency: string;
}