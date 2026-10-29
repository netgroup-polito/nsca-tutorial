export function sanitizeRequestLatency(value: string): string | null {
    const filtered = value.replace(/[^\d]/g, "");
    if (filtered === "") return "";
    const num = Number(filtered);
    if (num > 1000000) return null;

    return filtered;
}