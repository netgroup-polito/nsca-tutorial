import '../style/App.css'
import Canvas from '../components/Canvas'
import LeftPanel from '../components/LeftPanel'
import Navbar from '../components/Navbar'
import RightPanel from '../components/RightPanel'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import BottomPanel from '../components/BottomPanel'
import { useAppContext } from '../context/AppContext'
import { ConfirmationTab } from '../components/ConfirmationTab'
import { validateIpAddresses } from '../utils/validators/ip'
import ResultNotification from '../components/ResultNotification'
import { useEffect, useState } from 'react'
import LoadingScreen from '../components/LoadingScreen'
import type { Requirement } from '../types/NodeTypes'
import { BACKEND_BASE_URL } from '../utils/constants'

function CanvasEditor() {
    const {
        nodes, setNodes, edges, setEdges, requirements, setRequirements,
        allocationConstraints, linkConstraints,
        firewallConfigurations, setFirewallConfigurations,
        leftPanelCollapsed, setLeftPanelCollapsed,
        rightPanelCollapsed, setRightPanelCollapsed,
        bottomPanelCollapsed, setBottomPanelCollapsed,
        setEditNodesCollapsed,
        confirmDialog, setConfirmDialog,
        notification, setNotification,
        loading, setLoading,
        stableState, setStableState,
        reactOption,
        reactSelected,
    } = useAppContext();

    const [selectedAlgorithm, setSelectedAlgorithm] = useState<"AP"|"MF">("AP");
    
    useEffect(() => {
        if (notification) {
            const timeout = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timeout);
        }
    }, [notification]);


    const findNodeErrors = () => {
        let errors = false;
        const incomplete_nodes = nodes.filter(n => n.name.trim() === "" || n.ip === "" || !validateIpAddresses(n.ip));
        if (incomplete_nodes.length > 0) {
            setNodes(() => nodes.map(n => incomplete_nodes.find(n1 => n1.id === n.id) ? {...n, error:true} : {...n, error: false})); 
            errors = true;
        }
        const nameCounts = new Map<string, number>();
        const ipCounts = new Map<string, number>();
        for (const node of nodes) {
            if (nameCounts.get(node.name.trim().toLowerCase())){
                setNodes(() => nodes.map(n => n.name.trim().toLowerCase() === node.name.trim().toLowerCase() ? {...n, error: true} : {...n, error: false}));
                errors = true;
            } else {
                nameCounts.set(node.name.trim().toLowerCase(), 1);
            }

            if(ipCounts.get(node.ip.trim().toLowerCase())) {
                setNodes(() => nodes.map(n => n.ip.trim().toLowerCase() === node.ip.trim().toLowerCase() ? {...n, error: true} : {...n, error: false}));
                errors = true;
            } else {
                ipCounts.set(node.ip.trim().toLowerCase(), 1);
            }
        }
        return errors;
    }


    const handleRun = async () => {
        if (findNodeErrors()) return;

        setNodes(() => (nodes.map(n => ({...n, error: false}))));

        
        if (requirements.length === 0 ) {
            setConfirmDialog({text: "You need to add requirements before running Verefoo.", onConfirm: () => {setConfirmDialog(null); setBottomPanelCollapsed(true)}})
            return;
        }

        const payload = {
            nodes,
            edges,
            requirements,
            allocationConstraints,
            linkConstraints,
            firewallConfigurations,
            selectedAlgorithm,
            ...( reactOption && reactSelected && {initialRequirements: stableState.requirements}),
        };
        

        setLoading(true);
        try {
            const response = await fetch(BACKEND_BASE_URL + "run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.log(response)
                console.error("Run failed:", response.statusText);
                setNotification({text:"Run failed: " + response.statusText, color: "red"});
                return;
            }

            const result = await response.json();
            console.log(result);

            setNodes((prev) => {
                const updatedNodes = prev.map((node) => {
                    const returnedNode = result.nodes.find((n: any) => n.ip === node.ip);
                    if (!returnedNode) return node;

                    return {
                        ...node,
                        type: returnedNode.type == "AllocationPlace" ? "Forwarder" : returnedNode.type,
                        updated: node.type !== returnedNode.type,
                        ...(returnedNode.firewallId !== undefined && {firewallId: returnedNode.firewallId})
                    };
                });

                const newFirewalls = result.nodes
                    .filter((n: any) => 
                        n.type === "Firewall" &&
                        !prev.some((node) => node.ip === n.ip)
                    ).map((firewall: any) => {
                        
                        const connectedEdges = result.edges.filter(
                            (e: any) => e.nodeFrom === firewall.id || e.nodeTo === firewall.id
                        );

                        const neighborIds = connectedEdges.map((e: any) =>
                            e.nodeFrom === firewall.id ? e.nodeTo : e.nodeFrom
                        );

                        const n1 = updatedNodes.find((n: any) => n.id === neighborIds[0]);
                        const n2 = updatedNodes.find((n: any) => n.id === neighborIds[1]);

                        return {
                            ...firewall,
                            x: n1 && n2 ? (n1.x + n2.x) / 2 : 0,
                            y: n1 && n2 ? (n1.y + n2.y) / 2 : 0,
                            updated: true,
                        };
                    });
                
                const newForwarders = result.nodes
                    .filter((n: any) => 
                        (n.type === "AllocationPlace" || n.type === "Forwarder") &&
                        !prev.some((node) => node.ip === n.ip)
                    ).map((forwarder: any) => {
                        
                        const connectedEdges = result.edges.filter(
                            (e: any) => e.nodeFrom === forwarder.id || e.nodeTo === forwarder.id
                        );

                        const neighborIds = connectedEdges.map((e: any) =>
                            e.nodeFrom === forwarder.id ? e.nodeTo : e.nodeFrom
                        );

                        const n1 = updatedNodes.find((n: any) => n.id === neighborIds[0]);
                        const n2 = updatedNodes.find((n: any) => n.id === neighborIds[1]);

                        return {
                            ...forwarder,
                            x: n1 && n2 ? (n1.x + n2.x) / 2 : 0,
                            y: n1 && n2 ? (n1.y + n2.y) / 2 : 0,
                            type: "Forwarder",
                            updated: true,
                        };
                    });
                        
                setStableState({nodes: [...updatedNodes, ...newFirewalls, ...newForwarders], edges: result.edges, requirements: result.requirements, allocationConstraints: result.allocationConstraints, linkConstraints: result.linkConstraints});
                return [...updatedNodes, ...newFirewalls, ...newForwarders];
            });

            setEdges(result.edges);
            
            setRequirements(result.requirements);
            const returnedFirewallConfigurations = (result.firewallConfigurations ?? []).map((fw: any) => {
                const matchedNode = nodes.find((n) => n.ip === fw.ip);
                return { ...fw, id: matchedNode ? matchedNode.id : fw.id };
            });
            setFirewallConfigurations(returnedFirewallConfigurations);

            const sat = result.requirements.every((r: Requirement) => r.isSat === true);
            setNotification({text: sat ? "All requirements are satisfied": "Requirements could not be satisfied", color: sat? "green": "red"});
            
        } catch (err) {
            console.error("Could not reach backend:", err);
            setNotification({text: "Could not reach backend", color: "red"});
        } finally {
			setLoading(false);
		}
    };

    return (
        <DndProvider backend={HTML5Backend}>
            {confirmDialog && <ConfirmationTab text={confirmDialog.text} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null) }></ConfirmationTab>}
            {notification && <ResultNotification text={notification.text} color={notification.color}/>}
            {loading && <LoadingScreen/>}
            <Navbar onTogglePanel={(panel) => {
                    if (panel === "right") setRightPanelCollapsed(prev => !prev);
                    if (panel === "left") setLeftPanelCollapsed(prev => !prev);
                    if (panel === "requirements") setBottomPanelCollapsed(prev => !prev);
                    if (panel === "edit-nodes") setEditNodesCollapsed(prev => !prev);
                }}
                nodes={nodes}
                onRun={handleRun}
                selectedAlgorithm = {selectedAlgorithm}
                setSelectedAlgorithm = {setSelectedAlgorithm}
            />
            <div className='main-div'>
                <LeftPanel 
                    collapse={leftPanelCollapsed}
                    setCollapse={setLeftPanelCollapsed}
                />
                <Canvas/>
                <RightPanel 
                    collapse={rightPanelCollapsed} 
                    setCollapse={setRightPanelCollapsed}
                />
                <BottomPanel
                    opened={bottomPanelCollapsed}
                    setOpened={setBottomPanelCollapsed}
                />
            </div>
        </DndProvider>
    )
}

export default CanvasEditor;
