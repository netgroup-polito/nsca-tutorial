import { Edit, Trash } from "lucide-react";
import type { Requirement } from "../types/NodeTypes";
import { sanitizeIpAddresses, validateIpAddresses } from "../utils/validators/ip";
import { sanitizePorts, validatePorts } from "../utils/validators/port";
import { useEffect, useRef, useState } from "react";
import "../style/requirementsPanel.css";
import { useAppContext } from "../context/AppContext";

type RequirementsPanelProps = {
    requirements: Requirement[];
    setRequirements: React.Dispatch<React.SetStateAction<Requirement[]>>;
    opened:boolean;
}

export default function RequirementsPanel({requirements, setRequirements, opened}: RequirementsPanelProps) {
    const { reactOption, reactSelected, setReactSelected } = useAppContext();
    const [addingRequirements, setAddingRequirements] = useState<boolean>(false); 
    const [newRequirement, setNewRequirement] = useState<Requirement>({id: -1, sourceIP:"", destIP: "", sourcePort: "", destPort: "", protocol: "ANY", action:"Deny"});
    const [errors, setErrors] = useState<{sourceIP: string, destIP: string, sourcePort: string, destPort: string}>({sourceIP:"", destIP:"", sourcePort:"", destPort:""})
    const [reqId, setReqId] = useState(requirements.reduce((max, r) => Math.max(max, r.id), 0) + 1);
    const [saved, setSaved] = useState<boolean>(false);
    const closeRef = useRef<HTMLDivElement>(null);
    const addReqsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setReqId(requirements.reduce((max, r) => Math.max(max, r.id), 0) + 1);
    }, [requirements]);

    const validateFields = () => {
        const sourceAddressErrors = validateIpAddresses(newRequirement.sourceIP);
        const destAddressErrors = validateIpAddresses(newRequirement.destIP);
        const sourcePortErrors = validatePorts(newRequirement.sourcePort);
        const destPortErrors = validatePorts(newRequirement.destPort);

        if(!sourceAddressErrors){
            setErrors((prev) => ({...prev, sourceIP:"Enter a valid source IP"}))
        }
        if(!destAddressErrors){
            setErrors((prev) => ({...prev, destIP:"Enter a valid destination IP"}))            
        }
        if(!sourcePortErrors){
            setErrors((prev) => ({...prev, sourcePort: "Enter a valid source port"}))
        }
        if(!destPortErrors){
            setErrors((prev) => ({...prev, destPort: "Enter a valid destination port"}))
        }
        return sourceAddressErrors && destAddressErrors && sourcePortErrors && destPortErrors;
    }

    useEffect(() => {
        setErrors({sourceIP:"", destIP:"", sourcePort:"", destPort:""});
        if(saved) {
            validateFields();
        }
    }, [newRequirement, saved])

    useEffect(() => {
        if(opened && addingRequirements) {
            closeRef.current?.focus();
        }
    }, [addingRequirements]);


    useEffect(() => {
        if (opened && addReqsRef.current) addReqsRef.current.tabIndex = 0;
    }, [opened]);
    

    const handleSaveRequirement = () => {
        setSaved(true);
        if (!validateFields()) return;
        if(newRequirement['id'] === -1) {
            newRequirement['id'] = reqId;
            setReqId((prev) => prev+1);
            setRequirements((prev) => ([...prev, newRequirement]));
        } else {
            setRequirements((prev) => prev.map((r) => r.id===newRequirement.id ? newRequirement : r))
        }
        setAddingRequirements(false);
        setSaved(false);
        setNewRequirement({id: -1, sourceIP:"", destIP: "", sourcePort: "", destPort: "", protocol: "ANY", action:"Deny"});
    }

    function handleDeleteRequirement(req: Requirement) {
        setRequirements((prev) => prev.filter(r => r.id!=req.id))
    }

    function handleEditRequiement(req: Requirement) {
        setNewRequirement(req);
        setAddingRequirements(true);
    }  

    return(<div className="requirements-div">
                    { !addingRequirements && 
                    <div className="add-requirements-btn-div">
                        <div className="add-requirements-btn" ref={addReqsRef} onKeyDown={(e) => {if (e.key === "Enter") {
                            e.preventDefault();
                            setAddingRequirements(true);
                        } }} onClick={() => setAddingRequirements(true)}>
                            <p>+ Add Requirements</p>
                        </div>
                        { reactOption && 
                            <label className="react-option">
                                <input type="checkbox" 
                                checked={reactSelected}
                                onChange={() => setReactSelected(prev => !prev)}
                                />
                                <p>React Verefoo</p>
                            </label>
                        }
                    </div>
                    }
                    {addingRequirements && <div className="add-requirements-div">
                        <p className="new-requirement-p">New Requirement</p>
                        <div className="requirement-form">
                            <div className="requirement-input-div">
                                <p className="requirement-label">Source IP</p>
                                <input type="text" value={newRequirement.sourceIP}
                                onChange={(e) => {const filtered = sanitizeIpAddresses(e.target.value);
                                                    if (filtered === null) return;
                                                    setNewRequirement((prev) => ({...prev, sourceIP: filtered}));

                                        }}
                                name="" id=""  className={`requirement-input ${errors.sourceIP ? "input-error" : ""}`}
                                />
                            </div>
                            <div className="requirement-input-div">
                                <p className="requirement-label">Destination IP</p>
                                <input type="text" value={newRequirement.destIP}
                                onChange={(e) => {
                                    const filtered = sanitizeIpAddresses(e.target.value);
                                    if(filtered === null) return;
                                    setNewRequirement((prev) => ({...prev, destIP: filtered}));
                                }}
                                name="" id="" className={`requirement-input ${errors.destIP ? "input-error" : ""}`}/>
                            </div>
                            <div className="requirement-input-div">
                                <p className="requirement-label">Source Port</p>
                                <input type="text" value={newRequirement.sourcePort} 
                                onChange={(e) => {
                                    const filtered = sanitizePorts(e.target.value);
                                    if(filtered === null) return;
                                    setNewRequirement((prev) => ({...prev, sourcePort: filtered}));
                                }}
                                name="" id="" className={`requirement-input ${errors.sourcePort ? "input-error" : ""}`}/>
                            </div>
                            <div className="requirement-input-div">
                                <p className="requirement-label">Destination Port</p>
                                <input type="text" value={newRequirement.destPort} 
                                onChange={(e) => {
                                    const filtered = sanitizePorts(e.target.value);
                                    if (filtered === null) return;
                                    setNewRequirement((prev) => ({...prev, destPort: filtered}))
                                }}
                                name="" id="" className={`requirement-input ${errors.destPort ? "input-error" : ""}`}/>
                            </div>
                            <div className="requirement-input-div">
                                <p className="requirement-label">Protocol</p>
                                <select value={newRequirement.protocol} 
                                onChange={(e) => {
                                    setNewRequirement((prev) => ({...prev, protocol: e.target.value as Requirement['protocol']}))
                                }}
                                name="" id="" className="requirement-input">
                                    <option value="ANY">ANY</option>
                                    <option value="TCP">TCP</option>
                                    <option value="UDP">UDP</option>
                                    <option value="OTHER">OTHER</option>
                                </select>
                            </div>
                            <div className="requirement-input-div">
                                <p className="requirement-label">Action</p>
                                <select value={newRequirement.action} 
                                onChange={(e) => {
                                    setNewRequirement((prev) => ({...prev, action: e.target.value as Requirement['action']}))
                                }}
                                name="" id="" className="requirement-input">
                                    <option value="Allow">Allow</option>
                                    <option value="Deny">Deny</option>
                                </select>
                            </div>
                        </div>
                        <div className="buttons-div">
                            <div className="save-btn" tabIndex={0} onKeyDown={(e) => {if (e.key === "Enter") {handleSaveRequirement()}}} onClick={() => handleSaveRequirement()}>
                                <p>Save</p>
                            </div>
                            <div ref={closeRef} className="close-btn" tabIndex={0} onKeyDown={(e) => {if (e.key === "Enter") {setAddingRequirements(false)}}} onClick={() => {setAddingRequirements(false);
                                setNewRequirement({id: -1, sourceIP:"", destIP: "", sourcePort: "", destPort: "", protocol: "TCP", action:"Deny"});
                                setSaved(false);
                            }}>
                                <p>Cancel</p>
                            </div>
                        </div>
                    </div>}
                    <div className="requirements-table">
                        <div className="requirements-header">
                            <p>Source IP</p>
                            <p>Destination IP</p>
                            <p>Source Port</p>
                            <p>Destination Port</p>
                            <p>Protocol</p>
                            <p>Action</p>
                            <p>Satisfied</p>
                        </div>
                        {requirements.length === 0 && <p className="empty-name">
                            No requirements added yet.
                        </p>}
                        {requirements.map((req) => (
                            <div className={`requirements-row ${req.id === newRequirement.id && 'requirements-row-selected'}`}
                            
                            key={req.id}>
                                <p>{req.sourceIP}</p>
                                <p>{req.destIP}</p>
                                <p>{req.sourcePort}</p>
                                <p>{req.destPort}</p>
                                <p>{req.protocol}</p>
                                <div className="all-actions-div">
                                    <div className="action-div" style={{border: req.action === "Allow" ? "1px solid var(--btn-green)" : "1px solid var(--btn-red)", backgroundColor: req.action==="Allow" ? "var(--btn-green-transparent)" : "var(--btn-red-transparent)"}}>
                                        <p style={{color: req.action==="Allow"? "var(--btn-green)" : "var(--btn-red)"}}>{req.action}</p>
                                    </div>
                                    <Edit style={{cursor: "pointer"}} onClick={() => handleEditRequiement(req)}/>
                                    <Trash style={{cursor: "pointer"}} onClick={() => handleDeleteRequirement(req)}/>
                                </div>
                                <p>{req.isSat === undefined ? "" : req.isSat === true ? "True": "False"}</p>
                            </div>
                        ))}
                    </div>
                </div>);
}