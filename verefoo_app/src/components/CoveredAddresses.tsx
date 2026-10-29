import "../style/coveredAddresses.css";
import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";

type CoveredAddressesProp = {
    valuesOnLoad: string[],
    onChange: (ips: string[]) => void;
}

export default function CoveredAddresses({valuesOnLoad, onChange}: CoveredAddressesProp) {
    const { nodes } = useAppContext();
    const [selectedIPs, setSelectedIPs] = useState<string[]>([]);

    const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const ip = e.target.value;
        if (ip && !selectedIPs.includes(ip)) {
            setSelectedIPs([...selectedIPs, ip]);
        }
        e.target.value = "";
    };

    const removeIP = (ip: string) => {
        setSelectedIPs(selectedIPs.filter((s) => s !== ip));
    };

    useEffect(() => {
        setSelectedIPs(valuesOnLoad);
    }, []);

    useEffect(() => {
        onChange(selectedIPs);
    }, [selectedIPs]);


    return (
        <div className="covered-address-field">
            <div className="covered-address-list">
                {selectedIPs.length === 0 && (
                    <span className="covered-address-empty">No addresses selected</span>
                )}
                {selectedIPs.map((s) => (
                    <div className="covered-address-tag" key={s}>
                        <span>{s}</span>
                        <span className="covered-address-remove" onClick={() => removeIP(s)}>
                            ×
                        </span>
                    </div>
                ))}
            </div>
            <select className="covered-select" value="" onChange={handleSelect}>
                <option value="" disabled>
                    Select an address
                </option>
                {nodes.map((n) => (
                    n.ip &&
                    <option key={n.id} value={n.ip}>
                        {n.ip}
                    </option>
                ))}
            </select>
        </div>
    );
}