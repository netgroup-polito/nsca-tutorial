export function sanitizeName(name: string): string | null {
  if (
    name.length === 0 ||
    name.length > 64 ||
    !/^[a-zA-Z0-9_. -]+$/.test(name)
  ) {
    return null;
  }

  return name;
}