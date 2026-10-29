export const validateIp = (ip: string) : boolean => {
	const parts = ip.trim().split(".");
	if (parts.length !== 4) return false;
	for (let part of parts) {
		try {
			if (part.includes(" ")) return false;
			const partInt = parseInt(part);
			if (partInt < -1 || partInt > 255) return false; 
		} catch (err) {
			if (part !== "*") return false;
		} 
	}

	return true;
}

export const validatePort = (port: string) : boolean => {
	try {
		const portInt = parseInt(port.trim());
		if (portInt < 0 || portInt > 65535) return false;
	} catch (err) {
		if (port !== "*") return false;
	}
	return true;
}

export const validateName = (name: string): boolean => {
  if (
    name.length > 64 ||
    name.trim().length < 1 ||
    !/^(?=.*[a-zA-Z0-9])[a-zA-Z0-9_. -]+$/.test(name)
  ) {
    return false;
  }

  return true;
};

export const validateType = (type: string): boolean => {
	const allowed_types = ["EndPoint", "AllocationPlace", "NAT", "LoadBalancer", "Firewall", "Forwarder", "TrafficMonitor"];
	if (!allowed_types.includes(type)) return false;
	return true;
}

export const validateAction = (action: string): boolean => {
	if (action.trim() === "Allow" || action.trim() === "Deny") return true;
	return false;
}

export const validateProtocol = (protocol: string): boolean => {
	if (["tcp", "udp", "any", "other"].includes(protocol.trim().toLowerCase())) return true;
	return false;
}