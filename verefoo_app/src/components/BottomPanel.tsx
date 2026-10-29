import { useEffect, useRef, useState } from "react";
import "../style/bottomPanel.css";
import { ChevronDown } from "lucide-react";
import RequirementsPanel from "./RequirementsPanel";
import ConstraintsPanel from "./ConstraintsPanel";
import ConfigurationsPanel from "./ConfugurationsPanel";
import { useAppContext } from "../context/AppContext";

type BottomPanelProps = {
    opened: boolean;
    setOpened: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function BottomPanel({ opened, setOpened}: BottomPanelProps) {
   
    const {requirements, setRequirements, allocationConstraints, setAllocationConstraints, linkConstraints, setLinkConstraints, firewallConfigurations, nodes, selectedOption, setSelectedOption} = useAppContext();
    const [resizing, setResizing] = useState<boolean>(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: MouseEvent) => {
        if (!resizing || !panelRef.current) return;
        const resultingHeight = window.innerHeight - e.clientY;
        if (resultingHeight < 0.2 * window.innerHeight) {
            setResizing(false);
            setOpened(false);
            return;
        }
        panelRef.current.style.height = `${resultingHeight}px`;
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

    return(
        <div className="requirements-panel-div" ref={panelRef} style={{transform: opened ? "translateY(0)" : "translateY(100%)"}}>
            <div className="displace-button" onClick={() => {
                setOpened(prev => {
                    const next = !prev;
                    if (next && panelRef.current) {
                        panelRef.current.style.height = "fit-content";
                    }
                    return next;
                });
            }}>
               <ChevronDown style={{transform: opened ? "": "rotate(-180deg)", transition: "transform ease 0.4s"}}/>
            </div>
            <div className="requirements-panel-inside-div">
                <div 
                className="expand-div" 
                style={{backgroundColor: resizing? "lightblue": ""}}
                onMouseDown={() => setResizing(true)}
                onMouseUp={() => setResizing(false)}
                />
                <div className="requirements-panel-tab-div">
                    <div className="requirements-panel-tab" onClick={() => setSelectedOption("Requirements")} style={{backgroundColor: selectedOption==="Requirements" ? "var(--bg-bars)" : ""}}><p>REQUIREMENTS</p></div>
                    <div className="requirements-panel-tab" onClick={() => setSelectedOption("Constraints")} style={{backgroundColor: selectedOption==="Constraints" ? "var(--bg-bars)" : ""}}><p>CONSTRAINTS</p></div>
                    <div className="requirements-panel-tab" onClick={() => setSelectedOption("Configurations")} style={{backgroundColor: selectedOption==="Configurations" ? "var(--bg-bars)" : ""}}><p>CONFIGURATIONS</p></div>
                </div>
                {selectedOption==="Requirements" && <RequirementsPanel opened={opened} requirements={requirements} setRequirements={setRequirements}/>}
                {selectedOption ==="Constraints" && <ConstraintsPanel allocationConstraints={allocationConstraints} setAllocationConstraints={setAllocationConstraints} linkConstraints={linkConstraints} setLinkConstraints={setLinkConstraints} nodes={nodes}/>}
                {selectedOption ==="Configurations" && <ConfigurationsPanel firewallConfigurations={firewallConfigurations} nodes={nodes} /> }
            </div>
        </div>
    )
}