import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Edge, FirewallConfiguration, NetworkNode, Requirement } from '../types/NodeTypes';
import type { AllocationConstraint, LinkConstraint } from '../types/ConstraintTypes';

interface AppState {
  nodes: NetworkNode[];
  setNodes: React.Dispatch<React.SetStateAction<NetworkNode[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  requirements: Requirement[];
  setRequirements: React.Dispatch<React.SetStateAction<Requirement[]>>;
  allocationConstraints: AllocationConstraint[];
  setAllocationConstraints: React.Dispatch<React.SetStateAction<AllocationConstraint[]>>;
  linkConstraints: LinkConstraint[];
  setLinkConstraints: React.Dispatch<React.SetStateAction<LinkConstraint[]>>;
  selectedNodeId: number | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<number | null>>;
  firewallConfigurations: FirewallConfiguration[];
  setFirewallConfigurations: React.Dispatch<React.SetStateAction<FirewallConfiguration[]>>;
  leftPanelCollapsed: boolean;
  setLeftPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  rightPanelCollapsed: boolean;
  setRightPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  bottomPanelCollapsed: boolean;
  setBottomPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  selectedOption: "Requirements" | "Constraints" | "Configurations";
  setSelectedOption: React.Dispatch<React.SetStateAction<"Requirements" | "Constraints" | "Configurations">>;
  editNodesCollapsed: boolean;
  setEditNodesCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  closedSidePanel: boolean;
  setClosedSidePanel: React.Dispatch<React.SetStateAction<boolean>>;
  confirmDialog: { text: string, onConfirm: () => void } | null;
  setConfirmDialog: React.Dispatch<React.SetStateAction<{ text: string, onConfirm: () => void} | null>>;
  notification: { text: string, color?: "red" | "green" | undefined } | null;
  setNotification: React.Dispatch<React.SetStateAction<{ text: string, color?: "red" | "green" | undefined} | null>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  stableState: {nodes: NetworkNode[], edges: Edge[], requirements: Requirement[], linkConstraints: LinkConstraint[], allocationConstraints: AllocationConstraint[]};
  setStableState: React.Dispatch<React.SetStateAction<{nodes: NetworkNode[], edges: Edge[], requirements: Requirement[], linkConstraints: LinkConstraint[], allocationConstraints: AllocationConstraint[]}>>;
  modified: boolean;
  setModified: React.Dispatch<React.SetStateAction<boolean>>;
  reactOption: boolean;
  setReactOption: React.Dispatch<React.SetStateAction<boolean>>;
  reactSelected: boolean;
  setReactSelected: React.Dispatch<React.SetStateAction<boolean>>;
  deployedNodes: NetworkNode[];
  setDeployedNodes: React.Dispatch<React.SetStateAction<NetworkNode[]>>;
  terminalOpenRequest: number | null;
  requestTerminalOpen: (nodeId: number) => void;
  clearTerminalOpenRequest: () => void;
}
const AppContext = createContext<AppState | null>(null);

export function saveCanvasState (deployedNodesOverride: NetworkNode[], nodes: NetworkNode[], edges:Edge[], requirements: Requirement[], allocationConstraints: AllocationConstraint[], linkConstraints: LinkConstraint[], firewallConfigurations: FirewallConfiguration[], stableState:{nodes: NetworkNode[], edges: Edge[], requirements: Requirement[], linkConstraints: LinkConstraint[], allocationConstraints: AllocationConstraint[]}) {
    localStorage.setItem(
        "canvas_state",
        JSON.stringify({
            nodes,
            edges,
            requirements,
            allocationConstraints,
            linkConstraints,
            firewallConfigurations,
            deployedNodes: deployedNodesOverride,
            stableState,
        })
    );
};


export function AppProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [allocationConstraints, setAllocationConstraints] = useState<AllocationConstraint[]>([]);
  const [linkConstraints, setLinkConstraints] = useState<LinkConstraint[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [firewallConfigurations, setFirewallConfigurations] = useState<FirewallConfiguration[]>([]);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(true);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"Requirements" | "Constraints" | "Configurations">("Requirements");
  const [editNodesCollapsed, setEditNodesCollapsed] = useState(false);
  const [closedSidePanel, setClosedSidePanel] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ text: string; onConfirm: () => void } | null>(null);
  const [notification, setNotification] = useState<{ text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stableState, setStableState] = useState<{nodes: NetworkNode[], edges: Edge[], requirements: Requirement[], linkConstraints: LinkConstraint[], allocationConstraints: AllocationConstraint[]}>({nodes: [], edges: [], allocationConstraints: [], linkConstraints: [], requirements: []});
  const [modified, setModified] = useState<boolean>(false);
  const [reactOption, setReactOption] = useState<boolean>(false);
  const [reactSelected, setReactSelected] = useState<boolean>(false);
  const [deployedNodes, setDeployedNodes] = useState<NetworkNode[]>([]);
  const [terminalOpenRequest, setTerminalOpenRequest] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("canvas_state");

    console.log("I am here");
    if (saved) {
      const state = JSON.parse(saved);

      setNodes(state.nodes ?? []);
      setEdges(state.edges ?? []);
      setRequirements(state.requirements ?? []);
      setAllocationConstraints(state.allocationConstraints ?? []);
      setLinkConstraints(state.linkConstraints ?? []);
      setFirewallConfigurations(state.firewallConfigurations ?? []);
      setDeployedNodes(state.deployedNodes ?? []);
      setStableState(state.stableState ?? []);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    const timeout = setTimeout(() => {
      saveCanvasState(deployedNodes, nodes, edges, requirements, allocationConstraints, linkConstraints, firewallConfigurations, stableState);
    }, 500);

    return () => clearTimeout(timeout);
  }, [loaded, nodes, edges, requirements, allocationConstraints, linkConstraints, firewallConfigurations, deployedNodes, stableState]);

  function normalizeNodes (nodesList: NetworkNode[]) {
    return nodesList.map(({x, y, width, height, error, updated, resultingWidth, resultingHeight, ...rest}) => rest);
  }

  useEffect(() => {
    console.log("Deployed nodes");
    console.log(deployedNodes);
  }, [deployedNodes]);

  useEffect(() => {
    const stable = JSON.stringify({
      nodes: normalizeNodes(stableState.nodes),
      edges: stableState.edges,
      requirements: stableState.requirements,
      linkConstraints: stableState.linkConstraints,
      allocationConstraints: stableState.allocationConstraints
    });

    const current = JSON.stringify({
      nodes: normalizeNodes(nodes),
      edges,
      requirements,
      linkConstraints,
      allocationConstraints
    });
    setModified(!(stable === current));
    
    const stableNodesEdges = JSON.stringify({
      nodes: normalizeNodes(stableState.nodes),
      edges: stableState.edges
    });

    const currentNodesEdges = JSON.stringify({
      nodes: normalizeNodes(nodes),
      edges
    });

    if(stableState.nodes.length > 0 && stableNodesEdges === currentNodesEdges) {
      setReactOption(true);
    } else {
      setReactOption(false);
    }
  }, [nodes, edges, requirements, allocationConstraints, linkConstraints]);

  return (
    <AppContext.Provider value={{
      nodes, setNodes, edges, setEdges,
      requirements, setRequirements,
      allocationConstraints, setAllocationConstraints,
      linkConstraints, setLinkConstraints,
      selectedNodeId, setSelectedNodeId,
      firewallConfigurations, setFirewallConfigurations,
      leftPanelCollapsed, setLeftPanelCollapsed,
      rightPanelCollapsed, setRightPanelCollapsed,
      bottomPanelCollapsed, setBottomPanelCollapsed,
      selectedOption, setSelectedOption,
      editNodesCollapsed, setEditNodesCollapsed,
      closedSidePanel, setClosedSidePanel, 
      confirmDialog, setConfirmDialog,
      notification, setNotification,
      loading, setLoading,
      stableState, setStableState,
      modified, setModified,
      reactOption, setReactOption,
      reactSelected, setReactSelected,
      deployedNodes, setDeployedNodes,
      terminalOpenRequest,
      requestTerminalOpen: setTerminalOpenRequest,
      clearTerminalOpenRequest: () => setTerminalOpenRequest(null),
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}