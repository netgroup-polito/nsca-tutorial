import { useState } from "react";
import "../style/configurationsPanel.css";
import type { FirewallConfiguration, NetworkNode } from "../types/NodeTypes";
import { useAppContext } from "../context/AppContext";

type ConfigurationsPanelProps = {
    firewallConfigurations: FirewallConfiguration[];
    nodes: NetworkNode[];
};

export default function ConfigurationsPanel({
    firewallConfigurations,
    nodes,
}: ConfigurationsPanelProps) {
    const { selectedNodeId } = useAppContext();
    const [selectedConfiguration, setSelectedConfiguration] = useState<number>(selectedNodeId || -1);

    const selectedFirewall = firewallConfigurations.find(
        config => config.id === selectedConfiguration
    );

    if (firewallConfigurations.length === 0) {
        return (
            <div className="configurations-div">
                <div className="no-configurations-state">
                    <p className="no-configurations-title">
                        No firewall configurations
                    </p>
                    <p className="no-configurations-subtitle">
                        Run Verefoo to get firewall configurations
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="configurations-div">
            <div className="firewall-select">
                <select
                    className="configurations-input"
                    value={selectedConfiguration}
                    onChange={(e) =>
                        setSelectedConfiguration(Number(e.target.value))
                    }
                >
                    <option value={-1}>Select a firewall</option>

                    {firewallConfigurations.map(config => {
                        const node = nodes.find(n => n.id === config.id);

                        return (
                            <option key={config.id} value={config.id}>
                                {node?.name ?? `Firewall ${config.id}`}
                            </option>
                        );
                    })}
                </select>
            </div>

            <div className="configurations-table">
                <div className="configurations-header">
                    <p>Source IP</p>
                    <p>Destination IP</p>
                    <p>Source Port</p>
                    <p>Destination Port</p>
                    <p>Protocol</p>
                    <p>Action</p>
                </div>
                {selectedConfiguration === -1 && <p className="empty-name">Select a firewall to view its configuration.</p>}
                {selectedFirewall?.config.length === 0 && 
                    <p className="empty-name">This firewall contains no rules</p>
                }
                {selectedFirewall?.config.map((rule, index) => (
                    <div className="configurations-row" key={index}>
                        <p>{rule.sourceIP}</p>
                        <p>{rule.destIP}</p>
                        <p>{rule.sourcePort}</p>
                        <p>{rule.destPort}</p>
                        <p>{rule.protocol}</p>
                        <p>{rule.action}</p>
                    </div>
                ))}
            </div>
            {selectedFirewall && <div className="default-div">
                    <p className="default-config-p">Default Configuration</p>
                    <div className="action-div" style={{border: selectedFirewall.default === "Allow" ? "1px solid var(--btn-green)" : "1px solid var(--btn-red)", backgroundColor: selectedFirewall.default ==="Allow" ? "var(--btn-green-transparent)" : "var(--btn-red-transparent)"}}>
                        <p style={{color: selectedFirewall.default==="Allow"? "var(--btn-green)" : "var(--btn-red)"}}>{selectedFirewall.default}</p>
                    </div>
            </div>}
        </div>
    );
}