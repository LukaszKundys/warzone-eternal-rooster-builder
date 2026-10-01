import { ALLEGIANCE_LABEL, type Allegiance } from "../lib/types";
import { PLAYABLE_FACTIONS, counts, emptyForce, forceReducer, sizeName, toStored, type Force, type ForceAction, type StoredRoster } from "./force";
import { DATA, assetById, factionName, unitById, validate } from "./rules";

/** Plain-text force list: header, units with attached assets, force assets, totals and issues. */
export function toText(name: string, f: Force): string {
  const { force, kit } = counts(f);
  const v = validate(force, kit, f.faction, f.gameSize, f.allegiance);
  const lines = [
    name,
    `${factionName(f.faction)} · ${ALLEGIANCE_LABEL[f.allegiance]} · ${f.gameSize} DP (${sizeName(f.gameSize)})`,
    "",
  ];
  f.units.forEach((x) => {
    const u = unitById(x.u);
    if (!u) return;
    lines.push(`${`${u.n} ${u.v}`.trim()} — ${u.dp} DP`);
    x.k.forEach((a) => lines.push(`  + ${assetById(a)?.n ?? a} — ${assetById(a)?.dp ?? 0} DP`));
  });
  if (f.forceAssets.length) {
    lines.push("", "Force assets");
    f.forceAssets.forEach((x) => lines.push(`  ${assetById(x.a)?.n ?? x.a} — ${assetById(x.a)?.dp ?? 0} DP`));
  }
  lines.push("", `Total: ${v.dp}/${f.gameSize} DP · Support points ${v.spSpent}/${v.spAvail} · ${v.unitCount} units`);
  if (v.unitCount === 0) lines.push("Force is empty");
  else if (v.issues.length) v.issues.forEach((i) => lines.push(`${i.sev === "error" ? "✕" : "!"} ${i.text}`));
  else lines.push("Legal");
  return lines.join("\n") + "\n";
}

export const toJson = (name: string, f: Force) => JSON.stringify({ name, ...toStored(f) }, null, 2) + "\n";

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "list";

export function download(name: string, ext: "txt" | "json", content: string) {
  const blob = new Blob([content], { type: ext === "json" ? "application/json" : "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(name)}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export class ImportError extends Error {}

const MAX_IMPORT_BYTES = 1_000_000;

/**
 * Read a file made by toJson. Rebuilds the force through the builder's own reducer, so the result
 * obeys the same rules as one built by hand (unique units, asset targets, the unit cap). Units and
 * assets that don't exist in this version of the data, or that the rules refuse, are skipped and counted.
 */
export function fromJson(text: string): { name: string; force: Force; skipped: number } {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportError("That file is too big to be a list export.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("That file isn't a list export: it isn't valid JSON.");
  }
  const d = data as Partial<StoredRoster> & { name?: unknown };
  if (!d || typeof d !== "object" || d.v !== 1) {
    throw new ImportError("That file isn't a Warzone Eternal list export, or it's from a newer version of the app.");
  }
  if (!PLAYABLE_FACTIONS.some((f) => f.id === d.faction)) throw new ImportError("The list's faction isn't one this app knows.");
  if (!DATA.allegiances.includes(d.allegiance as Allegiance)) throw new ImportError("The list's allegiance isn't one this app knows.");
  if (!DATA.gameSizes.some(([n]) => n === d.gameSize)) throw new ImportError("The list's game size isn't one this app knows.");
  const isStrings = (x: unknown): x is string[] => Array.isArray(x) && x.every((y) => typeof y === "string");
  const units = Array.isArray(d.units) ? d.units : [];
  if (!units.every((x) => x && typeof x === "object" && typeof x.u === "string" && isStrings(x.k)) || !isStrings(d.forceAssets ?? [])) {
    throw new ImportError("The list's units are in a format this app can't read.");
  }

  const setup: ForceAction[] = [
    { type: "setFaction", faction: d.faction! },
    { type: "setGameSize", gameSize: d.gameSize! },
    { type: "setAllegiance", allegiance: d.allegiance! },
  ];
  let f = setup.reduce(forceReducer, emptyForce());
  let skipped = 0;
  for (const x of units) {
    const before = f;
    f = forceReducer(f, { type: "add", unit: x.u });
    if (f === before) {
      skipped += 1 + x.k.length;
      continue;
    }
    const i = f.units[f.units.length - 1].i;
    for (const a of x.k) {
      const prev = f;
      f = forceReducer(f, { type: "attach", asset: a, i });
      if (f === prev) skipped++;
    }
  }
  for (const a of d.forceAssets ?? []) {
    const prev = f;
    f = forceReducer(f, { type: "addForceAsset", asset: a });
    if (f === prev) skipped++;
  }

  const name = typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 120) : "Imported list";
  return { name, force: f, skipped };
}
