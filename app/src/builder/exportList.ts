import { ALLEGIANCE_LABEL } from "../lib/types";
import { counts, sizeName, toStored, type Force } from "./force";
import { assetById, factionName, unitById, validate } from "./rules";

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
