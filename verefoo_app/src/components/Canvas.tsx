import { useDrop } from "react-dnd";
import "../style/canvas.css";
import { Move } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import NetworkNodeCanvas from "./NetworkNodeCanvas";
import Firewall from "../assets/network_icons/firewall.png";
import NAT from "../assets/network_icons/nat.png";
import EndPoint from "../assets/network_icons/end_point.png";
import AllocationPlace from "../assets/network_icons/allocation_point.png";
import LoadBalancer from "../assets/network_icons/load_balancer.png";
import Forwarder from "../assets/network_icons/layer-3-switch.png";
import TrafficMonitor from "../assets/network_icons/detector.png";
import type { DragItem, Edge } from "../types/NodeTypes";
import type { NetworkNode } from "../types/NodeTypes";
import { EditNodesBar } from "./EditNodesBar";
import { useAppContext } from "../context/AppContext";

const iconMap = {
    Firewall,
    NAT,
    EndPoint,
    AllocationPlace,
    LoadBalancer,
    Forwarder,
    TrafficMonitor,

};

const MIN_SCALE = 0.2;
const MAX_SCALE = 3;
const ZOOM_SENSITIVITY = 0.01;
const PAN_STEP = 40;

type SelectionRect = {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
};

function nodeCenter(node: NetworkNode) {
    return {
        x: node.x + (node.resultingWidth ?? node.width) / 2,
        y: node.y + (node.resultingHeight ?? node.height) / 2,
    };
}

export default function Canvas() {

    const {nodes, setNodes, edges, setEdges, selectedNodeId, setSelectedNodeId, setRightPanelCollapsed, closedSidePanel, editNodesCollapsed, setConfirmDialog, deployedNodes, requestTerminalOpen} = useAppContext();
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [isNodeConnecting, setIsNodeConnecting] = useState<boolean>(false);
    const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
    const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    // Multi-select
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<number>>(new Set());
    const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
    const isSelectingRef = useRef(false);
    const selectionRectRef = useRef<SelectionRect | null>(null);
    const didJustSelectRef = useRef(false);

    // Multi-drag
    const isDraggingMultiRef = useRef(false);
    const multiDragStartMouse = useRef({ x: 0, y: 0 });
    const multiDragStartPositions = useRef<Map<number, { x: number; y: number }>>(new Map());

    const isPanningRef = useRef(false);
    const spaceHeldRef = useRef(false);
    const didPanRef = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const scaleRef = useRef(scale);
    const panRef = useRef(pan);

    useEffect(() => { scaleRef.current = scale; }, [scale]);
    useEffect(() => { panRef.current = pan; }, [pan]);

    useEffect(() => {
        if (!selectedNodeId) setIsNodeConnecting(false);
    }, [selectedNodeId]);

    useEffect(() => {
        if (selectedNodeId) {
            if (!nodes.some(n => n.id === selectedNodeId)) setSelectedNodeId(null);
        }
        if (selectedNodeIds) {
            setSelectedNodeIds((prev) => {
                const next = new Set(prev);
                
                for (const id of prev) {
                    if (!nodes.some(n => n.id === id)) {
                        next.delete(id);
                    } 
                }
                return next;
            })
        }
    }, [nodes]);

    const clearAll = () => {
        if (didPanRef.current) {
            didPanRef.current = false;
            return;
        }
        if (didJustSelectRef.current) {
            didJustSelectRef.current = false;
            return;
        }
        setSelectedNodeId(null);
        setSelectedNodeIds(new Set());
        setSelectedEdge(null);
    };

    const onResize = useCallback((id: number, width: number, height: number) => {
        setNodes((prev) => {
            const target = prev.find(n => n.id === id);
            if (target && target.resultingWidth === width && target.resultingHeight === height) {
                return prev;
            }
            return prev.map((n) => n.id === id ? { ...n, resultingWidth: width, resultingHeight: height } : n);
        });
    }, [setNodes]);

    // ── DELETE ───────────────────────────────────────────────────────────────
    const handleDeleteNode = () => {
        const toDelete = selectedNodeIds.size > 0
            ? selectedNodeIds
            : selectedNodeId !== null ? new Set([selectedNodeId]) : new Set<number>();
        if (toDelete.size === 0) return;
        setConfirmDialog({text: "Do you want to delete the node?", onConfirm: deleteNode})
    };

    const deleteNode = () => {
        const toDelete = selectedNodeIds.size > 0
            ? selectedNodeIds
            : selectedNodeId !== null ? new Set([selectedNodeId]) : new Set<number>();
        if (toDelete.size === 0) return;
        setNodes(prev => prev.filter(n => !toDelete.has(n.id)));
        setEdges(prev => prev.filter(e => !toDelete.has(e.nodeFrom) && !toDelete.has(e.nodeTo)));
        setSelectedNodeIds(new Set());
        setSelectedNodeId(null);
        setIsNodeConnecting(false);
        setConfirmDialog(null);
    }

    const handleConnectNode = () => {
        selectedNodeId && setIsNodeConnecting(true);
    };
    

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const allowed_keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Delete"];
            if (!allowed_keys.includes(e.key)) return;
            const target = e.target as HTMLElement | null;

            if (e.key === "Delete") {
                if (selectedNodeId || selectedNodeIds) handleDeleteNode();
                if (selectedEdge) handleDeleteEdge();
                return;
            }
            const isTypingTarget =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target?.isContentEditable;
            if (isTypingTarget) return;

            const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
            if (arrowKeys.includes(e.key)) {
                e.preventDefault();
                const step = e.shiftKey ? PAN_STEP * 3 : PAN_STEP;
                setPan(prev => {
                    switch (e.key) {
                        case "ArrowUp":    return { x: prev.x, y: prev.y + step };
                        case "ArrowDown":  return { x: prev.x, y: prev.y - step };
                        case "ArrowLeft":  return { x: prev.x + step, y: prev.y };
                        case "ArrowRight": return { x: prev.x - step, y: prev.y };
                        default: return prev;
                    }
                });
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedNodeId, selectedNodeIds]);

    // ── ZOOM / SCROLL ────────────────────────────────────────────────────────
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey) {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const delta = -e.deltaY * ZOOM_SENSITIVITY;
            const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * (1 + delta)));
            const scaleRatio = newScale / scaleRef.current;
            setPan(prev => ({
                x: mouseX - scaleRatio * (mouseX - prev.x),
                y: mouseY - scaleRatio * (mouseY - prev.y),
            }));
            setScale(newScale);
            return;
        }
        setPan(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => container.removeEventListener("wheel", handleWheel);
    }, [handleWheel]);

    // ── SPACE PAN ────────────────────────────────────────────────────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            if (e.code === "Space" && !e.repeat) {
                e.preventDefault();
                spaceHeldRef.current = true;
                setSpaceHeld(true);
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            if (e.code === "Space") {
                spaceHeldRef.current = false;
                setSpaceHeld(false);
                isPanningRef.current = false;
                setIsPanning(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    // ── NODE SELECTION ───────────────────────────────────────────────────────
    const handleSelectNode = (node: NetworkNode) => {
        setNodes((prev) => prev.map(n => n.id === selectedNodeId ? {...n, updated: false} : n))    
        if (isNodeConnecting && selectedNodeId !== node.id && selectedNodeId !== null) {
            if (!edges.find(e => (e.nodeFrom === selectedNodeId && e.nodeTo === node.id) || (e.nodeTo === selectedNodeId && e.nodeFrom === node.id))) {
                setEdges(prev => ([...prev, { nodeFrom: selectedNodeId, nodeTo: node.id }]));

            }
            setIsNodeConnecting(false);
            return;
        }
        setSelectedEdge(null);
        setSelectedNodeIds(new Set());
        setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
        if (selectedNodeId !== node.id && !closedSidePanel) setRightPanelCollapsed(false);
    };

    // ── EDGE ─────────────────────────────────────────────────────────────────
    const handleDeleteEdge = () => {
        setEdges(prev => prev.filter(e => e.nodeFrom !== selectedEdge?.nodeFrom || e.nodeTo !== selectedEdge.nodeTo));
        setSelectedEdge(null);
    };

    // ── MOUSE DOWN (canvas background only) ──────────────────────────────────
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0 || (e.target instanceof Element && e.target.closest(".canvas-hud"))) return;

        if (spaceHeldRef.current || !e.shiftKey) {
            e.preventDefault();
            isPanningRef.current = true;
            didPanRef.current = false;
            setIsPanning(true);
            lastMouse.current = { x: e.clientX, y: e.clientY };
            return;
        }

        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - panRef.current.x) / scaleRef.current;
        const canvasY = (e.clientY - rect.top - panRef.current.y) / scaleRef.current;
        isSelectingRef.current = true;
        const sel = { startX: canvasX, startY: canvasY, currentX: canvasX, currentY: canvasY };
        selectionRectRef.current = sel;
        setSelectionRect(sel);
    };

    // ── NODE MOUSE DOWN ───────────────────────────────────────────────────────
    const handleNodeMouseDown = (e: React.MouseEvent, node: NetworkNode) => {
        e.stopPropagation();
        if (selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)) {
            e.preventDefault();
            isDraggingMultiRef.current = true;
            multiDragStartMouse.current = { x: e.clientX, y: e.clientY };
            const positions = new Map<number, { x: number; y: number }>();
            nodes.forEach(n => {
                if (selectedNodeIds.has(n.id)) positions.set(n.id, { x: n.x, y: n.y });
            });
            multiDragStartPositions.current = positions;
        }
    };

    // ── MOUSE MOVE ───────────────────────────────────────────────────────────
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanningRef.current) {
            const dx = e.clientX - lastMouse.current.x;
            const dy = e.clientY - lastMouse.current.y;
            lastMouse.current = { x: e.clientX, y: e.clientY };
            if (dx !== 0 || dy !== 0) didPanRef.current = true;
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            return;
        }
        if (isDraggingMultiRef.current) {
            const dx = (e.clientX - multiDragStartMouse.current.x) / scaleRef.current;
            const dy = (e.clientY - multiDragStartMouse.current.y) / scaleRef.current;
            setNodes(prev => prev.map(n => {
                const start = multiDragStartPositions.current.get(n.id);
                if (!start) return n;
                return { ...n, x: start.x + dx, y: start.y + dy };
            }));
            return;
        }
        if (isSelectingRef.current && selectionRectRef.current) {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const canvasX = (e.clientX - rect.left - panRef.current.x) / scaleRef.current;
            const canvasY = (e.clientY - rect.top - panRef.current.y) / scaleRef.current;
            const updated = { ...selectionRectRef.current, currentX: canvasX, currentY: canvasY };
            selectionRectRef.current = updated;
            setSelectionRect({ ...updated });
        }

        const container = containerRef.current;
        if (container) {
            const rect = container.getBoundingClientRect();
            setCursorPos({
                x: (e.clientX - rect.left - panRef.current.x) / scaleRef.current,
                y: (e.clientY - rect.top - panRef.current.y) / scaleRef.current,
            });
        }

    };

    // ── MOUSE UP ─────────────────────────────────────────────────────────────
    const handleMouseUp = () => {
        isPanningRef.current = false;
        setIsPanning(false);
        isDraggingMultiRef.current = false;

        if (isSelectingRef.current && selectionRectRef.current) {
            const sel = selectionRectRef.current;
            const x1 = Math.min(sel.startX, sel.currentX);
            const y1 = Math.min(sel.startY, sel.currentY);
            const x2 = Math.max(sel.startX, sel.currentX);
            const y2 = Math.max(sel.startY, sel.currentY);

            if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
                const hit = new Set<number>();
                nodes.forEach(n => {
                    if ((n.x + n.width) >= x1 && n.x <= x2 && (n.y + n.height) >= y1 && n.y <= y2) {
                        hit.add(n.id);
                    }
                });
                if (hit.size > 0) {
                    setSelectedNodeIds(hit);
                    setSelectedNodeId(null);
                    setSelectedEdge(null);
                    didJustSelectRef.current = true;
                }
            }
        }

        isSelectingRef.current = false;
        selectionRectRef.current = null;
        setSelectionRect(null);
    };

    const handleReset = () => {
        setScale(1);
        setPan({ x: 0, y: 0 });
    };

    // ── DROP ──────────────────────────────────────────────────────────────────
    const [{ isOver }, dropRef] = useDrop(() => ({
        accept: ["Node", "CanvasNode"],
        drop: (item: DragItem, monitor) => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            if (item.kind === 'new') {
                const coordinates = monitor.getClientOffset();
                if (!coordinates) return;
                const NODE_SIZE = 47;
                const x = (coordinates.x - rect.left - panRef.current.x) / scaleRef.current - NODE_SIZE / 2;
                const y = (coordinates.y - rect.top - panRef.current.y) / scaleRef.current - NODE_SIZE / 2;
                setNodes(prev => {
                    const nextId = prev.reduce((max, n) => Math.max(max, n.id), 0) + 1;
                    return [
                        ...prev,
                        { id: nextId, name: `Node ${nextId}`, type: item.type, x, y, width: 75, height: 75, ip: "" },
                    ];
                });
            } else {
                const sourceOffset = monitor.getSourceClientOffset();
                if (!sourceOffset) return;
                const x = (sourceOffset.x - rect.left - panRef.current.x) / scaleRef.current;
                const y = (sourceOffset.y - rect.top - panRef.current.y) / scaleRef.current;

                setNodes(prev => prev.map(n => n.id === item.id ? { ...n, x, y } : n));
            }
        },
        collect: monitor => ({ isOver: monitor.isOver() }),
    }), []);

    // Selection rect in screen-space for rendering
    const selRectStyle = selectionRect ? (() => {
        const x1 = Math.min(selectionRect.startX, selectionRect.currentX);
        const y1 = Math.min(selectionRect.startY, selectionRect.currentY);
        const x2 = Math.max(selectionRect.startX, selectionRect.currentX);
        const y2 = Math.max(selectionRect.startY, selectionRect.currentY);
        return {
            left: x1 * scaleRef.current + panRef.current.x,
            top: y1 * scaleRef.current + panRef.current.y,
            width: (x2 - x1) * scaleRef.current,
            height: (y2 - y1) * scaleRef.current,
        };
    })() : null;
    

    return (
        <div
            ref={(node) => {
                dropRef(node);
                (containerRef as any).current = node;
            }}
            onClick={() => clearAll()}
            className={`canvas-div${isOver ? " canvas-over" : ""}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
                overflow: "hidden",
                position: "relative",
                cursor: isPanning ? "grabbing" : spaceHeld ? "grab" : isNodeConnecting ? "crosshair" : "default",   
            }}
        >
            <EditNodesBar
                handleDeleteNode={handleDeleteNode}
                selectedNodeId={selectedNodeId}
                selectedNodeIds={selectedNodeIds}
                handleConnectNode={handleConnectNode}
                isNodeConnecting={isNodeConnecting}
                selectedEdge={selectedEdge}
                handleDeleteEdge={handleDeleteEdge}
                collapse={editNodesCollapsed}
            />

            <div className="canvas-hud">
                <span>{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(prev => Math.max(MIN_SCALE, prev - 0.1))}> - </button>
                <button onClick={() => setScale(prev => Math.min(MAX_SCALE, prev + 0.1))}> + </button>
                <button onClick={handleReset} title="Reset view">Reset</button>
            </div>

            {nodes.length === 0 && (
                <div className="canvas-empty">
                    <Move className="move" />
                    <p className="information-text">Drag and drop network nodes here.</p>
                    <p className="information-smaller">Select nodes and use "Connect Nodes" to create connections.</p>
                </div>
            )}

            {selRectStyle && (
                <div className="canvas-selection-rect" style={{
                    position: "absolute",
                    left: selRectStyle.left,
                    top: selRectStyle.top,
                    width: selRectStyle.width,
                    height: selRectStyle.height,
                    pointerEvents: "none",
                    zIndex: 10,
                }} />   
            )}

            <svg className="canvas-svg" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
                <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,0 L5,3 z" fill="#aaa" />
                    </marker>
                    <marker id="arrowhead-active" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,0 L5,3 z" fill="var(--secondary-blue)" />
                    </marker>
                </defs>

                {edges.map(edge => {
                    const from = nodes.find(n => n.id === edge.nodeFrom);
                    const to = nodes.find(n => n.id === edge.nodeTo);
                    if (!from || !to) return null;

                    const { x: x1, y: y1 } = nodeCenter(from);
                    const { x: x2, y: y2 } = nodeCenter(to);

                    const isHovered = hoveredEdge?.nodeFrom === edge.nodeFrom && hoveredEdge?.nodeTo === edge.nodeTo;
                    const isSelected = selectedEdge?.nodeFrom === edge.nodeFrom && selectedEdge?.nodeTo === edge.nodeTo;
                    const isActive = isHovered || isSelected;

                    return (
                        <g key={`${edge.nodeFrom}-${edge.nodeTo}`}>
                            <line
                                x1={x1}
                                x2={x2}
                                y1={y1}
                                y2={y2}
                                stroke="transparent"
                                strokeWidth={20}
                                fill="none"
                                style={{ cursor: "pointer" }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseEnter={() => setHoveredEdge(edge)}
                                onMouseLeave={() => setHoveredEdge(null)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEdge(prev =>
                                        prev?.nodeFrom === edge.nodeFrom && prev?.nodeTo === edge.nodeTo ? null : edge
                                    );
                                    setSelectedNodeId(null);
                                }}
                            />
                            <line
                                x1={x1}
                                x2={x2}
                                y1={y1}
                                y2={y2}
                                stroke={isActive ? "var(--secondary-blue)" : "#b0b8c4"}
                                strokeWidth={isActive ? 1.5 : 1}
                                strokeOpacity={isActive ? 1 : 0.7}
                                fill="none"
                                pointerEvents="none"
                                markerEnd={isActive ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                                style={{ transition: "stroke 0.15s ease, stroke-opacity 0.15s ease" }}
                            />
                        </g>
                    );
                })}
                {isNodeConnecting && selectedNodeId !== null && cursorPos && (() => {
                    const sourceNode = nodes.find(n => n.id === selectedNodeId);
                    if (!sourceNode) return null;
                    const { x: x1, y: y1 } = nodeCenter(sourceNode);
                    const x2 = cursorPos.x;
                    const y2 = cursorPos.y;

                    return (
                        <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="var(--secondary-blue)"
                            strokeWidth={1.5}
                            strokeOpacity={0.5}
                            strokeDasharray="6 4"
                            markerEnd="url(#arrowhead-active)"
                            pointerEvents="none"
                        />
                    );
                })()}
            </svg>

            <div
                className="canvas-transform-layer"
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    transformOrigin: "0 0",
                    position: "absolute",
                    top: 0, left: 0,
                    width: "100%", height: "100%",
                    pointerEvents: "none",
                }}
            >
                {nodes.map(node => (
                    <div
                        key={node.id}
                        style={{ pointerEvents: "all" }}
                        onClick={(e) => { e.stopPropagation(); handleSelectNode(node); }}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (deployedNodes.some(deployedNode => deployedNode.id === node.id)) requestTerminalOpen(node.id);
                        }}
                        onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    >
                        <NetworkNodeCanvas
                            id={node.id}
                            name={node.name}
                            type={node.type}
                            icon={iconMap[node.type]}
                            x={node.x}
                            y={node.y}
                            width={node.width}
                            height={node.height}
                            selected={selectedNodeId === node.id}
                            multiSelected={selectedNodeIds.has(node.id)}
                            error={node.error ?? false}
                            updated={node.updated ?? false}
                            onSizeChange={onResize}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
