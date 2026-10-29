import { useEffect, useRef, useState } from "react";
import verefoo_logo from "../assets/verefoo_icon.png";
import "../style/navbar.css";
import Button from "./Button";
import { PlayIcon, Rocket, ChevronRight, Moon, Sun, CircleAlert, Bell, TerminalIcon } from "lucide-react";
import type { NetworkNode } from "../types/NodeTypes";
import { saveCanvasState, useAppContext } from "../context/AppContext";
import { validateIpAddresses } from "../utils/validators/ip";
import { BACKEND_BASE_URL, NODE_LIMIT_FOR_DEPLOYMENT } from "../utils/constants"

type NavbarProps = {
    onTogglePanel: (panel: "right" | "left" | "requirements" | "edit-nodes") => void;
    nodes: NetworkNode[];
    onRun: () => void;
	selectedAlgorithm: "AP" | "MF";
	setSelectedAlgorithm: React.Dispatch<React.SetStateAction<"AP" | "MF">>;
};

type NavbarNotification = {
	text: string;
	color?: "red" | "green";
	timestamp: number;
};

function Navbar({ onTogglePanel, onRun, selectedAlgorithm, setSelectedAlgorithm }: NavbarProps) {
	const {
		edges, requirements, allocationConstraints, linkConstraints,
		nodes, setNodes, setEdges, setRequirements, setAllocationConstraints, setLinkConstraints,
		setNotification, setConfirmDialog, firewallConfigurations, setFirewallConfigurations, setLoading, modified, stableState, setStableState, setReactSelected,
		deployedNodes, setDeployedNodes, notification, reactOption, terminalOpenRequest, clearTerminalOpenRequest
	} = useAppContext();

	const importInputRef = useRef<HTMLInputElement>(null);
	const [notificationList, setNotificationList] = useState<NavbarNotification[]>([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
	const [showTerminalsPanel, setShowTerminalsPanel] = useState(false);
	const [deployed, setDeployed] = useState(false);
	const [fileDrop, setFileDrop] = useState(false);
	const [saveDrop, setSaveDrop] = useState(false);
	const [viewDrop, setViewDrop] = useState(false);
  const [prefDrop, setPrefDrop] = useState(false);
	const [terminalStatus, setTerminalStatus] = useState<{id: number, status: string}[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
		document.documentElement.classList.add("dark");
		return true;
  });
	const terminalWindows = useRef<Map<number, Window>>(new Map());
	
  useEffect(() => {
		if (notification != null) {
			setNotificationList(prev => [...prev, { ...notification, timestamp: Date.now() }].slice(-50));
		}
  }, [notification]);

	useEffect(() => {
		if (terminalOpenRequest === null) return;
		const node = deployedNodes.find(candidate => candidate.id === terminalOpenRequest);
		if (node) openTerminalWindow(node);
		clearTerminalOpenRequest();
	}, [terminalOpenRequest, deployedNodes]);

	useEffect(() => {
		if(deployedNodes.length > 0) setDeployed(true);
	}, [deployedNodes]);

	useEffect(() => {
    const interval = setInterval(() => {
      terminalWindows.current.forEach((win, id) => {
				if (win.closed) {
					setTerminalStatus(prev =>
						prev.map(terminal =>
							terminal.id === id ? { ...terminal, status: "Closed" } : terminal
						)
					);
					terminalWindows.current.delete(id);
				}
      });
    }, 500);

    return () => clearInterval(interval);
	}, []);

	const [saveOptions, setSaveOptions] = useState({
		all: false,
		topology: false,
		requirements: false,
	});

	const handleDeploy = () => {
		if (deployed) {
			handleStopDeploy();
		} else {
			handleRunDeploy();
		}
	}

	const handleRunDeploy = async () => {
		if (stableState.nodes.length === 0) return; 
		if (modified) return;
    if (stableState.nodes.length > NODE_LIMIT_FOR_DEPLOYMENT) {
      setNotification({ text: "Cannot deploy more than " + NODE_LIMIT_FOR_DEPLOYMENT + " nodes", color: "red" });
      return;
    }
		try {
			setLoading(true);
			const response = await fetch(BACKEND_BASE_URL + "deploy", {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					nodes,
					edges,
					firewallConfigurations,
				}),
			});
			console.log(response);
			console.log(response.ok);
			if (response.ok) {
				setDeployed(true);
				saveCanvasState(nodes, nodes, edges, requirements, allocationConstraints, linkConstraints, firewallConfigurations, stableState);
				setDeployedNodes(nodes);
				const deployableNodes = nodes.filter(n => n.type !== 'AllocationPlace');
				setTerminalStatus(
					deployableNodes.map(n => ({
						id: n.id,
						status: "Closed"
					}))
				);
				setNotification({ text: "Simulation deployed successfully", color: "green" });
			} else {
				const error = await response.json();
				console.log(error);
				setNotification({text: error.error, color: "red"});
			}
		} catch (error) {
			// TODO add a more meaningful error
			setNotification({text: "Error deploying the topology", color: "red"});
		}
		setLoading(false);
	};

	const openTerminalWindow = (node: NetworkNode) => {
		const terminalWindow = window.open(
			`/terminal?nodeId=${node.id}`,
			`terminal_${node.id}`,
			'width=800,height=600,menubar=no,toolbar=no,location=no,status=no'
		);
		if (terminalWindow) {terminalWindows.current.set(node.id, terminalWindow)}
		setTerminalStatus(prev => prev.map(terminal => terminal.id === node.id ? {id:node.id, status: "Opened"} : terminal));
	}

	const handleStopDeploy = async () => {
		try {
			setLoading(true);
			const response = await fetch(BACKEND_BASE_URL + "deploy", 
				{
					method: "DELETE", 
					credentials: "include",
				}
			);
			if (response.ok) {
				terminalWindows.current.forEach(terminal => {
					if(!terminal.closed) {
						terminal.close();
					}
				});
				terminalWindows.current.clear();
				setTerminalStatus([]);
				setDeployed(false);
				setDeployedNodes([]);
			}
		} catch (error) {

		}
		setLoading(false);
	}

	const toggleOption = (key: keyof typeof saveOptions) => {
		if (key === "all") {
			const newVal = !saveOptions.all;
			setSaveOptions({ all: newVal, topology: newVal, requirements: newVal });
		} else {
			setSaveOptions(prev => {
				const updated = { ...prev, [key]: !prev[key] };
				const allChecked = updated.topology && updated.requirements;
				return { ...updated, all: allChecked };
			});
		}
	};

	const handleImportClick = () => {
		importInputRef.current?.click();
		setFileDrop(false);
	};

	const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;

		try {
			setLoading(true);
			setReactSelected(false);
			const xml = await file.text();
			const response = await fetch(BACKEND_BASE_URL + "import", {
				method: "POST",
				headers: { "Content-Type": "application/xml" },
				body: xml,
			});

			if (!response.ok) {
				console.error("Import failed:", response.statusText);
				setNotification({ text: "Import failed: " + response.statusText });
				return;
			}

			const topology = await response.json();
			console.log(topology);
			setDeployedNodes([]);
			setNodes(topology.nodesSaved ? (topology.nodes ?? []) : nodes);
			setEdges(topology.nodesSaved ? (topology.edges ?? []) : edges);
			setRequirements(topology.requirementsSaved ? (topology.requirements ?? []) : requirements);
			setAllocationConstraints(topology.allocationConstraints ?? allocationConstraints);
			setLinkConstraints(topology.linkConstraints ?? linkConstraints);
      setFirewallConfigurations(topology.nodesSaved? (topology.firewallConfigurations ?? []) : firewallConfigurations);
			setNotification({ text: "Topology imported successfully" });
			topology.reactSuitable && setStableState({nodes: topology.nodes ?? [], edges: topology.edges ?? [], requirements: topology.requirements ?? [],  linkConstraints: topology.linkConstraints ?? [], allocationConstraints: topology.allocationConstraints ?? []});
		} catch (err) {
			console.error("Could not import XML:", err);
			setNotification({ text: "Could not import XML", color: "red" });
		} finally {
			setLoading(false);
		}
	};

	const handleSaveAsXML = async () => {
		const includeNodes = saveOptions.topology;
		const includeProperties = saveOptions.requirements;

		if (!includeNodes && !includeProperties) return;

		if (includeNodes) {
			const incompleteNodes = nodes.filter(n => n.ip === "" || !validateIpAddresses(n.ip));
			if (incompleteNodes.length > 0) {
				setNodes(nodes.map(n => incompleteNodes.find(n1 => n1.id === n.id) ? { ...n, error: true } : n));
				setNotification({ text: "All nodes need a valid IP address before exporting" });
				return;
			}
			setNodes(nodes.map(n => n.error ? { ...n, error: false } : n));
		}

		try {
			setLoading(true);
			const response = await fetch(BACKEND_BASE_URL + "export", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					nodes, edges, requirements, allocationConstraints, linkConstraints,
					includeNodes, includeProperties, reactOption ,firewallConfigurations
				}),
			});

			if (!response.ok) {
				console.error("Export failed:", response.statusText);
				const err = await response.json();
				console.log(err);
				setNotification({ text: "Export failed: " + response.statusText, color: "red" });
				return;
			}

			const xml = await response.text();

			const supportsSavePicker = typeof (window as any).showSaveFilePicker === "function";

			if (supportsSavePicker) {
				try {
					const handle = await (window as any).showSaveFilePicker({
						suggestedName: "topology.xml",
						types: [
							{
								description: "XML Files",
								accept: {
									"application/xml": [".xml"],
								},
							},
						],
					});

					const writable = await handle.createWritable();
					await writable.write(xml);
					await writable.close();
				} catch (err) {
					if (err instanceof DOMException && err.name === "AbortError") return;
					throw err;
				}
			} else {
				const blob = new Blob([xml], { type: "application/xml" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = "topology.xml";
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(url);
			}

			setSaveDrop(false);
		} catch (err) {
			console.error("Could not export XML:", err);
			setNotification({ text: "Could not export XML", color: "red" });
		} finally {
			setLoading(false);
		}
	};

	const handleNew = () => {
		setConfirmDialog({text: "Create a new canvas? All current work will be deleted.", onConfirm: reset})
	}

	const reset = () => {
		if (deployed) handleStopDeploy();
		setNodes([]);
		setEdges([]);
		setRequirements([]);
		setAllocationConstraints([]);
		setLinkConstraints([]);
		setFirewallConfigurations([]);
		setConfirmDialog(null);
		setStableState({nodes: [], edges: [], requirements: [], linkConstraints: [], allocationConstraints: []});
		setDeployedNodes([]);
    setNotificationList([]);
	}

	return (
		<div className="navbar-div">
			<input
					ref={importInputRef}
					type="file"
					accept=".xml,application/xml,text/xml"
					style={{ display: "none" }}
					onChange={handleImportFile}
			/>
			<div className="navbar-left">
				<img src={verefoo_logo} alt="" className="logo"/>
				<div className="navbar-filename-options">
					<div className="navbar-options">
						<div onMouseEnter={() => setFileDrop(true)} onMouseLeave={() => setFileDrop(false)} className="navbar-option-div">
							<p>File</p>
							{fileDrop && (
								<div className="navbar-file-drop">
									<div className="navbar-drop-items" onClick={handleNew}><p>New</p></div>
									<div className="navbar-drop-items" onClick={() => {
										if (deployed) {
											setConfirmDialog({text: "The running deployment will stop if you proceed importing.", onConfirm: () => {
												handleStopDeploy();
												handleImportClick();
												setConfirmDialog(null);
											}})
										} else {
											handleImportClick();
										}
										}}><p>Import Existing</p></div>
									<div className="navbar-save"
									onMouseEnter={() => setSaveDrop(true)}
									onMouseLeave={() => setSaveDrop(false)}
									>
										<p>Save...</p>
										<ChevronRight size={16} cursor="pointer" color="var(--text-main)" strokeWidth={1.25}/>
										{saveDrop && (
											<div className="navbar-save-drop">
												{[
													{ key: "all", label: "All" },
													{ key: "topology", label: "Network topology graph" },
													{ key: "requirements", label: "Requirements" },
												].map(({ key, label }) => (
													<div
														key={key}
														className="navbar-drop-items navbar-save-option"
														onClick={() => toggleOption(key as keyof typeof saveOptions)}
													>
														<input
															type="checkbox"
															checked={saveOptions[key as keyof typeof saveOptions]}
															onChange={() => {}}
															onClick={(e) => {
																e.stopPropagation();
																toggleOption(key as keyof typeof saveOptions);
															}}
														/>
														<p>{label}</p>
													</div>
												))}
												<button className="navbar-save-button" onClick={handleSaveAsXML}>Save as XML</button>
											</div>
										)}
									</div>
								</div>
							)}
						</div>
						<div onMouseEnter={() => setViewDrop(true)} onMouseLeave={() => setViewDrop(false)} className="navbar-option-div">
							<p>View</p>
							{viewDrop && (
								<div className="navbar-file-drop">
										<div className="navbar-drop-items" onClick={() => onTogglePanel("left")}><p>Node List</p></div>
										<div className="navbar-drop-items" onClick={() => onTogglePanel("right")}><p>Node Properties</p></div>
										<div className="navbar-drop-items" onClick={() => onTogglePanel("edit-nodes")}><p>Node Editor</p></div>
										<div className="navbar-drop-items" onClick={() => onTogglePanel("requirements")}><p>Requirements</p></div>
								</div>
							)}
						</div> 
						<div onMouseEnter={() => setPrefDrop(true)} onMouseLeave={() => setPrefDrop(false)} className="navbar-option-div">
							<p>Preferences</p>
							{prefDrop && (
								<div className="navbar-file-drop">
									<div className="navbar-drop-items">
										<div className="navbar-drop-items navbar-save-option"
											style={{ gap: "10px" }}
											onClick={() => setDarkMode(prev => {
													const next = !prev;
													document.documentElement.classList.toggle("dark", next);
													return next;
											})}>
											<p>Dark Mode</p>
											<div className={`dark-mode-toggle ${darkMode ? "active" : ""}`}>
												<div className="dark-mode-toggle-knob">
													{darkMode
															? <Moon size={11} color="var(--btn-blue)" strokeWidth={2} />
															: <Sun size={11} color="var(--stroke)" strokeWidth={2} />
													}
												</div>
											</div>
										</div>
									</div>
									<div className="navbar-drop-items">
										<div className="algorithm-options-div">
											<div className="algorithm-option" 
												style={{backgroundColor: selectedAlgorithm === "AP" ? "var(--btn-blue)" : ""}} 
												onClick={() => setSelectedAlgorithm("AP")}>
												<p>AP</p>
											</div>
											<div className="algorithm-option" 
												style={{backgroundColor: selectedAlgorithm === "MF" ? "var(--btn-blue)" : ""}} 
												onClick={() => setSelectedAlgorithm("MF")}>
												<p>MF</p>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
						<div className="navbar-option-div">
							<a> Help </a>
						</div>
					</div>
				</div>
			</div>
			<div className="navbar-right">
				{
					modified && 
					<div className="rerun-div">
						<CircleAlert width={"15px"} height={"15px"}/>
						<p>Not run since last edit</p>
					</div>
				}
				{deployed && !modified && (
					<div className="terminals-div">
						<Button name="Terminals" color="blue" icon={TerminalIcon} func={() => setShowTerminalsPanel(prev => !prev)}/>
						{showTerminalsPanel && 
							<div className="terminals-panel-div">
								{terminalStatus.map((terminal) => {
									const deployedNode = deployedNodes.find((n) => n.id === terminal.id);
									if (!deployedNode) return;
									return (
									<div key={terminal.id} className="terminal-status-div">
										<p className="terminal-node-name-p">{deployedNode?.name}</p>
										{terminal.status === "Opened" ? (<p className="terminal-status-p">{terminal.status}</p>) : (<Button name="Open" color="blue" func={() => openTerminalWindow(deployedNode)}/>)}
									</div>
									)
								})}
								{terminalStatus.every(teminal => teminal.status === "Closed") && 
								(<div className="terminal-reopen-all-div" onClick={() => deployedNodes.forEach(n => openTerminalWindow(n))}>
									<p className="terminal-node-name-p">Reopen all</p>
								</div>)}
							</div>
						}
					</div>
				)}
				<Button name="Run" icon={PlayIcon} color="green" func={onRun} />
				<Button name={`${deployed && !modified ? "Stop deployment": "Deploy"}`} icon={Rocket} color={`${deployed ? 'red' : 'blue'}`} func={handleDeploy} disabled = {stableState.nodes.length === 0 || modified}/>
				<div className="notifications-div">
					<Button name={notificationList.length.toString()} icon={Bell} color="blue" func={() => setShowNotificationPanel(prev => !prev)}/>
					{ showNotificationPanel &&
						<div className="navbar-notifications">
						<div className="notifications-header">
							<p>Notifications</p>
							<div className="notifications-actions">
								<button type="button" onClick={() => setNotificationList([])} disabled={notificationList.length === 0}>Clear</button>
								<button type="button" onClick={() => setShowNotificationPanel(false)} aria-label="Close notifications">×</button>
							</div>
						</div>
						{notificationList.length === 0 ? (
							<p className="notifications-empty">No notifications</p>
						) : (
							[...notificationList].reverse().map((notification, index) => (
								<div className="notification"
									style={{ backgroundColor: `color-mix(in srgb, ${notification.color} 30%, transparent)`}}
									key={ index }>
									<p> {notification.text} </p>
									<p style={{fontSize: 13, opacity: 0.7}}> { new Date(notification.timestamp).toLocaleString() } </p>
								</div>
							))
						)}
						</div>
					}
				</div>
			</div>
		</div>
  );
}

export default Navbar;
