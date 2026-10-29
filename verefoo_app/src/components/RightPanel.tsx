import "../style/rightPanel.css";
import { ArrowLeftToLine, ArrowRightToLine, ChevronLeft, ChevronRight, Terminal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NetworkNode, NodeType } from "../types/NodeTypes";
import { sanitizeIpAddresses, validateIpAddresses } from "../utils/validators/ip";
import { useAppContext } from "../context/AppContext";
import { sanitizeName } from "../utils/validators/name";
import CoveredAddresses from "./CoveredAddresses";
import Button from "./Button";
import ConfigurationsPanel from "./ConfugurationsPanel";
import { BACKEND_BASE_URL } from "../utils/constants";

type RightPanelProp = {
    collapse: boolean;
    setCollapse: (collapsed: boolean) => void;
};

const typeColors: Record<NodeType, string> = {
  "LoadBalancer": "var(--node-endpoint)",
  "NAT": "var(--node-nat)",
  "Firewall": "var(--node-firewall)",
  "EndPoint": "var(--node-loadbalancer)",
  "AllocationPlace": "var(--node-allocationplace)",
  "Forwarder": "var(--node-forwarder)",
  "TrafficMonitor": "var(--node-trafficmonitor)"
};

export default function RightPanel({ collapse, setCollapse }: RightPanelProp) {
    const { nodes, setNodes, selectedNodeId, setClosedSidePanel, firewallConfigurations, setBottomPanelCollapsed, setSelectedOption, setLoading, deployedNodes, requestTerminalOpen } = useAppContext();
    const [resizing, setResizing] = useState(false);
    const [collapseConfig, setCollapseConfig] = useState(false);
    // const [collapseAppearance, setCollapseAppearance] = useState(false);
    const [lockDimensions, setLockDimensions] = useState(true);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const lastWidth = useRef<number>(300);
    const minWidth = 200;
    const maxWidth = 600;
    const inputFocus = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputFocus.current?.focus({ preventScroll: true });
    }, [selectedNodeId]);

    const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
    const selectedFirewallConfig = firewallConfigurations.find(
        c => c.id === selectedNodeId
    );

    const duplicateIpNodes = selectedNode
    ? nodes.filter(n =>
        n.ip.trim().toLowerCase() === selectedNode.ip.trim().toLowerCase()
    )
    : [];

    const duplicateNameNodes = selectedNode
    ? nodes.filter(n =>
        n.name.trim().toLowerCase() === selectedNode.name.trim().toLowerCase()
    )
    : [];

    const firewallRules = selectedFirewallConfig?.config ?? [];
    const firewallDefault = selectedFirewallConfig?.default ?? undefined;

    const validateNodes = (nodes: NetworkNode[]) => {
        const nameCounts = new Map<string, number>();
        const ipCounts = new Map<string, number>();

        for (const node of nodes) {
            const name = node.name.trim().toLowerCase();
            const ip = node.ip.trim().toLowerCase();

            if (name !== "") {
                nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
            }

            if (ip !== "") {
                ipCounts.set(ip, (ipCounts.get(ip) ?? 0) + 1);
            }
        }

        return nodes.map(node => {
            const name = node.name.trim().toLowerCase();
            const ip = node.ip.trim().toLowerCase();

            const invalidName = name === "";
            const invalidIp = ip === "" || !validateIpAddresses(node.ip);

            const duplicateName =
                name !== "" && (nameCounts.get(name) ?? 0) > 1;

            const duplicateIp =
                ip !== "" && (ipCounts.get(ip) ?? 0) > 1;

            return {
                ...node,
                error: invalidName || invalidIp || duplicateName || duplicateIp
            };
        });
    };

    const updateNode = <K extends keyof NetworkNode>(
        id: number,
        field: K,
        value: NetworkNode[K]
    ) => {
        setNodes(prev => {
            const updated = prev.map(n =>
                n.id === id
                    ? { ...n, [field]: value }
                    : n
            );

            return validateNodes(updated);
        });
};

    // needed only for the size adjustment which was removed 

    // const updateDimension = (field: "width" | "height", val: string) => {
    //     if (!selectedNode) return;
    //     if (lockDimensions) {
    //         updateNode(selectedNode.id, "width", val);
    //         updateNode(selectedNode.id, "height", val);
    //     } else {
    //         updateNode(selectedNode.id, field, val);
    //     }
    // };

    const handleMouseMove = (e: MouseEvent) => {
        if (!resizing || !panelRef.current) return;
        if ((window.innerWidth - e.clientX) > minWidth - 100) {
            setCollapse(false);
            let newWidth = (window.innerWidth - e.clientX);
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

            panelRef.current.style.width = `${newWidth}px`;
        } else if ((window.innerWidth - e.clientX) < minWidth - 100) {
            panelRef.current.style.width = "0px";
            setClosedSidePanel(true);
            setCollapse(true);
        }
    };

    const stopResize = () => setResizing(false);

    useEffect(() => {
        document.body.classList.add("no-select");
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", stopResize);

        return () => {
            document.body.classList.remove("no-select");
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", stopResize);
        };
    }, [resizing]);

    useLayoutEffect(() => {
        if (!panelRef.current) return;
        panelRef.current.style.width = collapse ? "0px" : `${lastWidth.current}px`;
    }, [collapse]);


    async function handleGetScript (firewallType: string) {
        setLoading(true);
        window.location.href = BACKEND_BASE_URL + `fwd/config/${firewallType}?id=${selectedNode?.firewallId}`;
        setLoading(false);
    }

    return (
        <div
            className={`right-panel-div ${collapse ? "collapsed" : ""} ${resizing ? "resizing" : ""}`}
            ref={panelRef}>
            {!collapse &&
                <>
                    <div className="right-panel-header">
                        <p className="right-panel-text">PROPERTIES</p>
                    </div>
                    {selectedNode ? (
                        <>
                            {/* CONFIGURATION  */}
                            <div className="right-panel-config-header">
                                    <ChevronRight className="right-panel-img" style={{ transform: `${collapseConfig ? '' : 'rotate(90deg)'}` }}
                                        onClick={() => setCollapseConfig((prev) => (!prev))}
                                        size={24} cursor="pointer"
                                        color="var(--text-main)" strokeWidth={1.25}
                                    />
                                    <p className="right-panel-text" style={{ fontSize: "13px" }}>CONFIGURATION</p>
                            </div>
                                
                            <div className={`right-panel-config-content ${collapseConfig ? "collapsed" : ""}`}>
                                {deployedNodes.some(node => node.id === selectedNode.id) && (
                                    <div className="right-panel-config">
                                        <Button name="Open terminal" color="blue" icon={Terminal} func={() => requestTerminalOpen(selectedNode.id)} />
                                    </div>
                                )}
                                <div className="right-panel-config">
                                    <p className="right-panel-config-text">Node Type</p>
                                    <span className={`right-panel-badge`}
                                    style={{
                                        backgroundColor: typeColors[selectedNode.type] || "blue"
                                    }}
                                    >
                                        {selectedNode.type}
                                    </span>
                                </div>
                                <div className="right-panel-config">
                                    <p className="right-panel-config-text">IP Address</p>
                                    <input
                                        ref={inputFocus}
                                        className={`right-panel-input ${selectedNode.error && (!validateIpAddresses(selectedNode.ip) || duplicateIpNodes.length > 1) && "input-error"}`}
                                        value={selectedNode.ip ?? ""}
                                        onChange={(e) => {
                                            const filtered = sanitizeIpAddresses(e.target.value);
                                            if(filtered === null) return;
                                            updateNode(selectedNode.id, "ip", filtered);
                                        }}
                                        placeholder="192.168.0.1"
                                    />
                                </div>
                                <div className="right-panel-config">
                                    <p className="right-panel-config-text">Name</p>
                                    <input
                                        type="text"
                                        className={`right-panel-input ${selectedNode.error && (selectedNode.name.trim() === "" || duplicateNameNodes.length > 1) && "input-error"}`}
                                        value={selectedNode.name}
                                        onChange={(e) => {
                                            const filtered = sanitizeName(e.target.value);
                                            if (filtered === null) return;
                                            updateNode(selectedNode.id, "name", filtered);
                                        }}
                                    />
                                </div>
                                {
                                    selectedNode.type === "NAT" && (
                                        <div className="right-panel-config">
                                            <p className="right-panel-config-text">Addresses covered by NAT</p>
                                            <CoveredAddresses
                                                valuesOnLoad={selectedNode.natAddresses ?? []}
                                                onChange={(ips) => updateNode(selectedNode.id, "natAddresses", ips)}
                                            />
                                        </div>
                                    )
                                }
                                {
                                    selectedNode.type === "LoadBalancer" && (
                                        <div className="right-panel-config">
                                            <p className="right-panel-config-text">Addresses covered by Load Balancer</p>
                                            <CoveredAddresses
                                                valuesOnLoad={selectedNode.loadBalancerPool ?? []}
                                                onChange={(ips) => updateNode(selectedNode.id, "loadBalancerPool", ips)}
                                            />
                                           </div>
                                    )
                                }
                                <div className="right-panel-config">
                                    <p className="right-panel-config-text">Description</p>
                                    <textarea
                                        className="right-panel-input"
                                        style={{ height: "50px", width: "200px" }}
                                        value={selectedNode.description ?? ""}
                                        onChange={(e) => updateNode(selectedNode.id, "description", e.target.value)}
                                    />
                                </div>
                                {
                                    selectedNode.type === "Firewall" && firewallDefault && 
                                    <div className="right-panel-config">
                                        <div className="right-panel-firewall-div">
                                            <p className="right-panel-config-text">Elements</p>
                                            <p
                                                onClick={() => {
                                                    setBottomPanelCollapsed(true);
                                                    setSelectedOption("Configurations");
                                                }}
                                                className="expand">
                                                Expand
                                            </p>
                                        </div>
                                        <div className="configurations-small-table">
                                            <div className="configurations-small-header">
                                                <p>Src. IP</p>
                                                <p>Dst. IP</p>
                                                <p>Src. Port</p>
                                                <p>Dst. Port</p>
                                                <p>Proto.</p>
                                                <p>Action</p>
                                            </div>
                                            {
                                                firewallRules.map((rule) => (
                                                    <div className="configurations-small-row">
                                                        <p>{rule.sourceIP}</p>
                                                        <p>{rule.destIP}</p>
                                                        <p>{rule.sourcePort}</p>
                                                        <p>{rule.destPort}</p>
                                                        <p>{rule.protocol}</p>
                                                        <p>{rule.action}</p>
                                                    </div>
                                                ))
                                            }
                                            {
                                                firewallDefault && 
                                                <div className="default-small-div">
                                                    <p className="default-config-small-p">Default configuration</p>
                                                    <div className="action-small-div" style={{border: firewallDefault === "Allow" ? "1px solid var(--btn-green)" : "1px solid var(--btn-red)", backgroundColor: firewallDefault ==="Allow" ? "var(--btn-green-transparent)" : "var(--btn-red-transparent)"}}>
                                                        <p className="action-small-p" style={{color: firewallDefault==="Allow"? "var(--btn-green)" : "var(--btn-red)"}}>{firewallDefault}</p>
                                                    </div>
                                                </div>
                                            }
                                        </div>
                                    </div>
                                }
                                {
                                    selectedNode.type === "Firewall" && firewallDefault && (
                                        <div className="right-panel-config">
                                            <p className="right-panel-config-text">Export configuration</p>
                                            <div className="right-panel-firewall-download">
                                                <div className="firewall-options-div"
                                                onClick={() => handleGetScript("iptables")}>
                                                    <p className="firewall-options-p">Iptables</p>
                                                </div>
                                                <div className="firewall-options-div"
                                                onClick={() => handleGetScript("openvswitch")}
                                                >
                                                    <p className="firewall-options-p">OpenVswitch</p>
                                                </div>
                                                <div className="firewall-options-div"
                                                onClick={() => handleGetScript("ipfw")}
                                                >
                                                    <p className="firewall-options-p">Ipfw</p>
                                                </div>
                                                <div className="firewall-options-div"
                                                onClick={() => handleGetScript("fortinet")}
                                                >
                                                    <p className="firewall-options-p">Fortinet</p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                            </div>

                            {/* APPEARANCE */}
                            {/* <div className="right-panel-config-header">
                                <ChevronRight className="right-panel-img" style={{ transform: `${collapseAppearance ? '' : 'rotate(90deg)'}` }}
                                    onClick={() => setCollapseAppearance((prev) => (!prev))}
                                    size={24} cursor="pointer"
                                    color="var(--text-main)" strokeWidth={1.25}
                                />
                                <p className="right-panel-text" style={{ fontSize: "13px" }}>APPEARANCE</p>
                            </div>

                            <div className={`right-panel-config-content ${collapseAppearance ? "collapsed" : ""}`}>
                                <div className="right-panel-config">
                                    <div className="right-panel-dimensions-header">
                                        <p className="right-panel-config-text">Dimensions</p>
                                        <label className="right-panel-lock-label">
                                            <input type="checkbox" checked={lockDimensions} onChange={(e) => setLockDimensions(e.target.checked)} style={{ display: "none" }} />
                                            <div className="right-panel-lock-label" title={lockDimensions ? "Unlink" : "Link"}>{lockDimensions ? <Link2 size={12} strokeWidth={1.5} color="var(--text-main)"/> : <Link2Off size={12} strokeWidth={1.5} color="var(--text-main)" />}</div>
                                        </label>
                                    </div>
                                    <div className="right-panel-dimensions">
                                        <div className="right-panel-input right-panel-dimension-input">
                                            <p className="right-panel-config-text">W</p>
                                            <input
                                                type="text"
                                                value={selectedNode.width}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, "");
                                                    if (Number(val) > 999) return;
                                                    updateDimension("width", val);
                                                }}
                                            />
                                        </div>
                                        <div className="right-panel-input right-panel-dimension-input">
                                            <p className="right-panel-config-text">H</p>
                                            <input
                                                type="text"
                                                value={selectedNode.height}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, "");
                                                    if (Number(val) > 999) return;
                                                    updateDimension("height", val);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div> */}
                        </>
                    ) : (
                        <p style={{ paddingLeft: "20px" }} className="right-panel-text">Select a node to view its properties</p>
                    )}
                </>
            }
            <div
                className="right-panel-resize-handle"
                style={{ backgroundColor: resizing ? "lightblue" : "" }}
                onMouseDown={() => setResizing(true)}
            />
            <div className="right-displace-button" onClick={() => {
                if (collapse) {
                    setClosedSidePanel(false);
                    setCollapse(false); 
                }
                else {
                    if (panelRef.current) {
                        lastWidth.current = panelRef.current.offsetWidth;
                        panelRef.current.style.width = "0px";
                    }
                    setClosedSidePanel(true);
                    setCollapse(true);
                }
                }}>
                <ChevronLeft style={{transform: collapse ? "": "rotate(-180deg)", transition: "transform ease 0.4s"}}/>
            </div>
        </div>
    );
}