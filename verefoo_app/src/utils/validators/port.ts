export function sanitizePorts(value: string): string | null {
    const filtered = value.replace(/[^\d*-]/g, "");

    if (filtered === "") return "";
    if (!/^(\*|\d+(?:-\d*)?)$/.test(filtered)) {
        return null;
    }

    if (filtered === "*") {
        return filtered;
    }

    const [startStr, endStr] = filtered.split("-");

    const start = Number(startStr);
    if (start > 65535) return null;

    if (endStr) {
        const end = Number(endStr);
        if (end > 65535) return null;
    }

    return filtered;
}

export function validatePorts(value: string): boolean {
    if (value === "*") {
        return true;
    }
    const match = value.match(/^(\d+)(?:-(\d+))?$/);
    if (!match) return false;

    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;

    return (
        start <= 65535 &&
        end <= 65535 &&
        start <= end
    );
}