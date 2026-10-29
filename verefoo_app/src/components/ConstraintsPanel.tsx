import { useEffect, useState } from "react";
import "../style/constraintsPanel.css";
import type { AllocationConstraint, LinkConstraint } from "../types/ConstraintTypes";
import { Edit, Trash } from "lucide-react";
import type { NetworkNode } from "../types/NodeTypes";
import { sanitizeRequestLatency } from "../utils/validators/requestLatency";

type ConstraintsPanelProps = {
    allocationConstraints: AllocationConstraint[];
    setAllocationConstraints: React.Dispatch<React.SetStateAction<AllocationConstraint[]>>;
    linkConstraints: LinkConstraint[];
    setLinkConstraints: React.Dispatch<React.SetStateAction<LinkConstraint[]>>;
    nodes: NetworkNode[];
}

export default function ConstraintsPanel ({allocationConstraints, setAllocationConstraints, linkConstraints, setLinkConstraints, nodes}: ConstraintsPanelProps) {
    const [addingConstraints, setAddingConstraints] = useState<boolean>(false);
    const [isViewingAllocationConstraints, setIsViewingAllocationConstraints] = useState<boolean>(true);
    const [newAllocationConstraint, setNewAllocationConstraint] = useState<AllocationConstraint>({id:-1, nodeA: -1, nodeB: -1, type:"Forbidden"});
    const [newLinkConstraint, setNewLinkConstraint] = useState<LinkConstraint>({id: -1, source: -1, destination:-1, requestLatency:""});
    const [allocationId, setAllocationId] = useState(1);
    const [linkId, setLinkId] = useState(1);
    const [allocationError, setAllocationError] = useState("");
    const [linkError, setLinkError] = useState("");
    const [latencyError, setLatencyError] = useState("");

    useEffect(() => {
    if (nodes.length > 0) {
        setNewAllocationConstraint(prev => ({
            ...prev,
            nodeA: prev.nodeA > 0 ? prev.nodeA : nodes[0].id,
            nodeB: prev.nodeB > 0 ? prev.nodeB : nodes[0].id,
        }));

        setNewLinkConstraint(prev => ({
            ...prev,
            source: prev.source > 0 ? prev.source : nodes[0].id,
            destination: prev.destination > 0 ? prev.destination : nodes[0].id,
        }));
    }
        setAllocationId(allocationConstraints.reduce((max, c) => Math.max(max, c.id), 0) + 1);
        setLinkId(linkConstraints.reduce((max, c) => Math.max(max, c.id), 0) + 1);

    }, [nodes, allocationConstraints, linkConstraints]);

    const handleAddAllocationConstraint = () => {
        let errors = false;
        if(newAllocationConstraint.nodeA===newAllocationConstraint.nodeB) {
            setAllocationError("Nodes must be different");
            errors = true;
        }
        if (newAllocationConstraint['id'] === -1) {
            const isDuplicate = allocationConstraints.some(
                (c) => c.nodeA === newAllocationConstraint.nodeA && c.nodeB === newAllocationConstraint.nodeB
            );
            if (isDuplicate) {
                setAllocationError("A constraint with between these two nodes already exists");
                errors = true;
            }
        }
        if (errors) return;

        if(newAllocationConstraint['id'] === -1) {
            newAllocationConstraint['id'] = allocationId;
            setAllocationId((prev) => prev + 1);
            setAllocationConstraints((prev) => [...prev, newAllocationConstraint]);
        } else {
            setAllocationConstraints((prev) => prev.map((c) => c.id === newAllocationConstraint.id ? newAllocationConstraint : c))
        }
        setAddingConstraints(false);
        setNewAllocationConstraint({id:-1, nodeA: -1, nodeB: -1, type:"Forbidden"});
    }

    const handleAddLinkConstraint = () => {
        let errors = false;
        if(newLinkConstraint.source===newLinkConstraint.destination) {
                setLinkError("Source and destination must be different");
                errors = true;
            }
        if (newLinkConstraint.requestLatency === "") {
                setLatencyError("Add a numeric request latency");
                errors = true;
        }

        if (newLinkConstraint.id === -1) {
            const isDuplicate = linkConstraints.some(
                (c) => c.source === newLinkConstraint.source && c.destination === newLinkConstraint.destination
            );
            if (isDuplicate) {
                setLinkError("A constraint with this source and destination already exists");
                errors = true;
            }
        }
        if (errors) return;
        if(newLinkConstraint['id'] === -1) {
            
            newLinkConstraint['id'] = linkId;
            setLinkId((prev) => prev + 1);
            setLinkConstraints((prev) => [...prev, newLinkConstraint]);
        } else {
            setLinkConstraints((prev) => prev.map((c) => c.id === newLinkConstraint.id ? newLinkConstraint : c));
        }
        setAddingConstraints(false);
        setNewLinkConstraint({id: -1, source: -1, destination:-1, requestLatency:""});
    }

    if (nodes.length === 0) {
        return (
            <div className="constraints-div">
                <div className="no-nodes-state">
                    <p className="no-nodes-title">No nodes available</p>
                    <p className="no-nodes-subtitle">Add nodes to the network before defining constraints.</p>
                </div>
            </div>
        )
    }

    return(
        <div className="constraints-div">
            <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                <div className="constraint-type-div">
                    <div className="constraint-name" onClick={() => setIsViewingAllocationConstraints(true)} style={{backgroundColor: isViewingAllocationConstraints ? "var(--bg-bars-reverse)" : "" }}>
                        <p>Allocation</p>
                    </div>
                    <div className="constraint-name" onClick={() => setIsViewingAllocationConstraints(false)} style={{backgroundColor: !isViewingAllocationConstraints ? "var(--bg-bars-reverse)" : "" }}>
                        <p>Link</p>
                    </div>
                </div>
                {!addingConstraints && <div className="add-requirements-btn" onClick={() => setAddingConstraints(true)}>
                    <p>+ Add Constraint</p>
                </div>}
            </div>
            {addingConstraints && ( isViewingAllocationConstraints ? 
                <div className="add-constraints-div">
                    <p className="new-constraint-p">NEW ALLOCATION CONSTRAINT</p>
                    <div className="constraint-form">
                        <div className="constraint-input-div">
                            <p className="constraint-label">Node A</p>
                            <select name="" id="" className={`constraint-input ${allocationError && 'input-error'}`}  value={newAllocationConstraint.nodeA} 
                            onChange={(e) => {
                                    setNewAllocationConstraint((prev) => ({...prev, nodeA: parseInt(e.target.value)}));
                                    setAllocationError("");
                                }}
                            >
                                    {nodes.map(n => (
                                        <option key={n.id} value={n.id}>{n.name}</option>
                                    ))}
                            </select>
                        </div>
                        <div className="constraint-input-div">
                            <p className="constraint-label">Node B</p>
                            <select name="" id="" className={`constraint-input ${allocationError && 'input-error'}`} value={newAllocationConstraint.nodeB} 
                            onChange={(e) => {
                                    setNewAllocationConstraint((prev) => ({...prev, nodeB: parseInt(e.target.value)}));
                                    setAllocationError("");
                                }}>
                            {nodes.map(n => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                            ))}    
                            </select>
                        </div>
                        <div className="constraint-input-div">
                                <p className="constraint-label">Type</p>
                                <select className="constraint-input" value={newAllocationConstraint.type}
                                    onChange={(e) => {setNewAllocationConstraint((prev) => ({...prev, type: e.target.value as AllocationConstraint['type']}))}}>
                                    <option value="Forced">Forced</option>
                                    <option value="Forbidden">Forbidden</option>
                                </select>
                        </div>
                        <div className="buttons-div">
                            <div className="save-btn" onClick={handleAddAllocationConstraint}>
                                <p>Save</p>
                            </div>
                            <div className="close-btn" onClick={() => {setAddingConstraints(false); setNewAllocationConstraint({id:-1, nodeA: -1, nodeB: -1, type:"Forbidden"}); setAllocationError("")}}>
                                <p>Cancel</p>
                            </div>
                        </div>
                    </div>
                    {allocationError && <p className="constraint-warning">{allocationError}</p>}
                </div> 
                :
                <div className="add-constraints-div">
                    <p className="new-constraint-p">NEW LINK CONSTRAINTS</p>
                    <div className="constraint-form">
                        <div className="constraint-input-div">
                            <p className="constraint-label">Source</p>
                            <select name="" id="" className={`constraint-input ${linkError && 'input-error'}`} value={newLinkConstraint.source} 
                            onChange={(e) => {
                                    setNewLinkConstraint((prev) => ({...prev, source: parseInt(e.target.value)}));
                                    setLinkError("");
                                }}>
                                    {nodes.map(n => (
                                        <option key={n.id} value={n.id}>{n.name}</option>
                                    ))}
                            </select>
                        </div>
                        <div className="constraint-input-div">
                            <p className="constraint-label">Destination</p>
                            <select name="" id="" className={`constraint-input ${linkError && 'input-error'}`} value={newLinkConstraint.destination} 
                            onChange={(e) => {
                                    setNewLinkConstraint((prev) => ({...prev, destination: parseInt(e.target.value)}));
                                    setLinkError("");
                                }}>
                                {nodes.map(n => (
                                    <option key={n.id} value={n.id}>{n.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="constraint-input-div">
                                <p className="constraint-label">Request Latency</p>
                                <input type="text" className={`constraint-input ${latencyError && 'input-error'}`} value={newLinkConstraint.requestLatency || ""} 
                                onChange={(e) => {
                                    const filtered = sanitizeRequestLatency(e.target.value);
                                    if (filtered === null) return;
                                    setLatencyError("");
                                    setNewLinkConstraint((prev) => ({...prev, requestLatency: filtered}))
                                }}/>
                        </div>
                        <div className="buttons-div">
                            <div className="save-btn" onClick={handleAddLinkConstraint}>
                                <p>Save</p>
                            </div>
                            <div className="close-btn" onClick={() => {setAddingConstraints(false); setNewLinkConstraint({id: -1, source: -1, destination:-1, requestLatency:""}); setLinkError(""); setLatencyError("");}}>
                                <p>Cancel</p>
                            </div>
                        </div>
                    </div>
                    {linkError && <p className="constraint-warning">{linkError}</p>}
                    {latencyError && <p className="constraint-warning">{latencyError}</p>}
                </div> 
            )}
            {isViewingAllocationConstraints ? 
                (<div className="constraints-table">
                    <div className="constraints-header">
                        <p>Node A</p>
                        <p>Node B</p>
                        <p>Type</p>
                        <p>Action</p>
                    </div>
                    {allocationConstraints.length === 0 && <p className="empty-name">
                        No allocation constraints added yet.
                    </p>}
                    {allocationConstraints.map((constraint) => (
                        <div className={`constraints-row ${newAllocationConstraint.id === constraint.id && "constraints-row-selected"}`}
                         key={constraint.id}>
                            <p>{nodes.find(n => n.id === constraint.nodeA)?.name}</p>
                            <p>{nodes.find(n => n.id === constraint.nodeB)?.name}</p>
                            <div className="constraint-type-div" style={{borderColor: constraint.type === "Forbidden" ? "var(--btn-red)" : "var(--btn-green)", backgroundColor: constraint.type === "Forbidden" ? "var(--btn-red-transparent)" : "var(--btn-green-transparent)",color: constraint.type === "Forbidden" ? "var(--btn-red)" : "var(--btn-green)"}} ><p>{constraint.type}</p></div>
                            <div className="all-actions-div">
                                <Edit style={{cursor: "pointer"}} onClick={() => {
                                    setAddingConstraints(true)
                                    setNewAllocationConstraint({id: constraint.id, nodeA: constraint.nodeA, nodeB: constraint.nodeB, type: constraint.type})
                                    }}/>
                                <Trash style={{cursor: "pointer"}} onClick={() => {
                                    setAllocationConstraints((prev) => (
                                        prev.filter((c) => c.id !== constraint.id)
                                    ))
                                }}/>
                            </div>
                        </div>
                    ))}
                </div>) :
                (<div className="constraints-table">
                    <div className="constraints-header">
                        <p>Source</p>
                        <p>Destination</p>
                        <p>Request latency</p>
                        <p>Action</p>
                    </div>
                    {linkConstraints.length === 0 && <p className="empty-name">
                        No link constraints added yet.
                    </p>}
                    {linkConstraints.map((constraint) => (
                        <div className={`constraints-row ${newLinkConstraint.id === constraint.id && "constraints-row-selected"}`}
                        key={constraint.id}>
                            <p>{nodes.find(n => n.id === constraint.source)?.name}</p>
                            <p>{nodes.find(n => n.id === constraint.destination)?.name}</p>
                            <p>{constraint.requestLatency}</p>
                            <div className="all-actions-div">
                                 <Edit style={{cursor: "pointer"}} onClick={() => {
                                    setAddingConstraints(true)
                                    setNewLinkConstraint({id: constraint.id, source: constraint.source, destination: constraint.destination, requestLatency: constraint.requestLatency})
                                    }}/>
                                <Trash style={{cursor: "pointer"}} onClick={() => {
                                    setLinkConstraints((prev) => (
                                        prev.filter((c) => c.id !== constraint.id)
                                    ))
                                }}/>
                            </div>
                        </div>
                    ))}
                </div>)
            }  
        </div>
    );
}