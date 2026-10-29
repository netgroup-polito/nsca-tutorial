import "../style/editNodesBar.css";
import { Link, Trash } from "lucide-react";
import type { Edge } from "../types/NodeTypes";

type EditNodesBarProps = {
    handleDeleteNode: () => void;
    selectedNodeId: number | null;
    selectedNodeIds: Set<number>;
    handleConnectNode: () => void;
    isNodeConnecting: boolean;
    selectedEdge: Edge | null;
    handleDeleteEdge: () => void;
    collapse: boolean;
};

export function EditNodesBar({
    handleDeleteNode,
    selectedNodeId,
    selectedNodeIds,
    handleConnectNode,
    isNodeConnecting,
    selectedEdge,
    handleDeleteEdge,
    collapse,
}: EditNodesBarProps) {
    const hasSingleSelection = selectedNodeId !== null;
    const hasMultiSelection = selectedNodeIds.size > 0;
    const hasAnyNodeSelection = hasSingleSelection || hasMultiSelection;

    const connectEnabled = hasSingleSelection && !isNodeConnecting;

    return (
        <div className={`edit-nodes-bar-div ${collapse ? "collapse" : ""}`}>
            <div
                className="edit-node-button-div"
                onClick={(e) => { e.stopPropagation(); connectEnabled && handleConnectNode(); }}
                style={{
                    backgroundColor: connectEnabled ? "var(--secondary-blue)" : "var(--disabled-button)",
                    cursor: connectEnabled ? "pointer" : "default",
                }}
            >
                <Link />
                <p>{isNodeConnecting ? "Select target node" : "Connect Node"}</p>
            </div>

            <div
                className="edit-node-button-div"
                onClick={() => hasAnyNodeSelection && handleDeleteNode()}
                style={{
                    backgroundColor: hasAnyNodeSelection ? "var(--btn-red)" : "var(--disabled-button)",
                    cursor: hasAnyNodeSelection ? "pointer" : "default",
                }}
            >
                <Trash />
                <p>
                    {hasMultiSelection
                        ? `Delete ${selectedNodeIds.size} Nodes`
                        : "Delete Node"}
                </p>
            </div>

            <div
                className="edit-node-button-div"
                onClick={() => selectedEdge && handleDeleteEdge()}
                style={{
                    backgroundColor: selectedEdge ? "var(--btn-red)" : "var(--disabled-button)",
                    cursor: selectedEdge ? "pointer" : "default",
                }}
            >
                <Trash />
                <p>Delete Link</p>
            </div>
        </div>
    );
}
