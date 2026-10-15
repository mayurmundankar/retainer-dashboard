/** Everhour and Monday often spell the same account differently. Resolve both onto the contract name. */

const ALIASES = new Map<string, string>([
  ["haus&haus", "haus & haus"],
  ["haus & haus - seo", "haus & haus"],
  ["haus & haus - website project", "haus & haus"],
  ["mal/hdv", "MHDV"],
  ["hdv / malmaison", "MHDV"],
  ["bm steel", "BM Steel / IMS"],
  ["ims", "BM Steel / IMS"],
  ["stanton & partners aviation", "Stanton Aviation"],
  ["matw project", "MATW"],
  ["aztec", "Aztec Group"],
  ["verkeer - marketing", "Verkeer"],
]);

export function clientKey(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function canonicalIndex(names: Iterable<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of names) {
    const clean = name.normalize("NFC").trim().replace(/\s+/g, " ");
    if (clean && !map.has(clientKey(clean))) map.set(clientKey(clean), clean);
  }
  return map;
}

export function resolveClient(raw: string, lookup: Map<string, string>, canonical: Map<string, string>): string {
  const trimmed = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  const key = clientKey(trimmed);
  return lookup.get(key) ?? canonical.get(key) ?? ALIASES.get(key) ?? trimmed;
}
