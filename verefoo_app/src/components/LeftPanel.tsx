import "../style/leftPanel.css";
import EndPoint from "../assets/network_icons/end_point.png";
import NAT from "../assets/network_icons/nat.png";
import LoadBalancer from "../assets/network_icons/load_balancer.png";
import AP from "../assets/network_icons/allocation_point.png";
import Firewall from "../assets/network_icons/firewall.png";
import Forwarder from "../assets/network_icons/layer-3-switch.png";
import TrafficMonitor from "../assets/network_icons/detector.png";
import { ChevronLeft } from "lucide-react";
import NetworkNode from "./NetworkNode";
import { useRef, useEffect, useState } from "react";

type LeftPanelProps = {
    collapse: boolean;
    setCollapse: (collapsed: boolean) => void;
}

export default function LeftPanel({ collapse, setCollapse }: LeftPanelProps) {
    const [resizing, setResizing] = useState(false); 
    const panelRef = useRef<HTMLDivElement | null>(null);
    const lastWidth = useRef<number>(300);
    const minWidth = 200;
    const maxWidth = 600;

    const handleMouseMove = (e: MouseEvent) => {
        if (!resizing || !panelRef.current) return;
        if (e.clientX > minWidth - 100) {
            setCollapse(false);
            let newWidth = e.clientX;
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

            panelRef.current.style.width = `${newWidth}px`;
        } else if (e.clientX < minWidth - 100) {
            panelRef.current.style.width = "0px";
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
  
    return(
            <div
                className={`left-panel-div ${collapse ? "collapsed" : ""} ${resizing ? "resizing" : ""}`}
                style={{width: collapse ? "0px" : ""}}
                ref={panelRef}
            >
            {!collapse && 
            <>   
            <div className="left-panel-header">
                <p className="left-panel-text">NETWORK NODES</p>
            </div>
            <NetworkNode name="End Point" type="EndPoint" icon={EndPoint}/>
            <NetworkNode name="NAT" type="NAT" icon={NAT}/>
            <NetworkNode name="Load Balancer" type="LoadBalancer" icon={LoadBalancer}/>
            <NetworkNode name="Allocation Place" type="AllocationPlace" icon={AP}/>
            <NetworkNode name="Traffic Monitor" type="TrafficMonitor" icon={TrafficMonitor}/>
            <NetworkNode name="Firewall" type="Firewall" icon={Firewall}/>
            <NetworkNode name="Forwarder" type="Forwarder" icon={Forwarder}/>
            </>
        }
        <div
            className="left-panel-resize-handle" 
            style={{backgroundColor: resizing ? "lightblue" : ""}}
            onMouseDown={() => setResizing(true)}
        />
        <div className="left-displace-button" onClick={() => {
                    if(!collapse) {
                        if (panelRef.current) {
                            lastWidth.current = panelRef.current.offsetWidth;
                            panelRef.current.style.width = "0px";
                        }
                        setCollapse(true);
                    } else {
                        setCollapse(false);
                        requestAnimationFrame(() => {
                            if (panelRef.current) {
                                panelRef.current.style.width = `${lastWidth.current}px`;
                            }
                        });
                    }
                    }}>
            <ChevronLeft style={{transform: !collapse ? "": "rotate(-180deg)", transition: "transform ease 0.4s"}}/>
        </div>
        </div>
    );
}