export function sanitizeIpAddresses(value:string): string | null {
    const filtered = value.replace(/[^\*\d.\-]/g, "");
    if (filtered.startsWith(".")) return null;
    if (filtered.includes("..")) return null;
    if (filtered.includes("-.")) return null;
    const parts = filtered.split(".");
    if (parts.length > 4) return null;
    const valid = parts.every(part => {
        if (part === "" || part === "-") return true;
        if (part.startsWith("-") && part !== "-1") return false;
        if (part === "*") part = "-1";
        const num = Number(part);
        return part.length <= 3 && num >= -1 && num <= 255;
    });
    return valid ? filtered : null;
}

export function validateIpAddresses(value: string): boolean {
    const parts = value.split(".")
    if(parts.length !== 4 || parts[0] === "" || parts[1] === "" || parts[2] === "" || parts[3] === "") {
        return false;
    }
    return true;
}