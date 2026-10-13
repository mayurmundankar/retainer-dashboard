/** Runtime env lookup. Bracket access stays dynamic so a host can inject values after the build. */
export function env(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
