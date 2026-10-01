import { ALLEGIANCE_LABEL, type Allegiance } from "../lib/types";
import rawData from "./data.json";
import rulesText from "./rulesText.json";

export type { Allegiance };

/**
 * Game data and force-building rules, ported from the design bundle's `wze-rules.js`.
 * Field names are kept short to match the extracted data in data.json.
 */

export type Lang = "en" | "pl";
export type Designation = "trooper" | "leader" | "specialist" | "support" | "unique";
export type AllyDesignation = "advisor" | "seconding" | "dark_cult";

export interface Faction {
  id: string;
  name: string;
  group: string;
  status?: string;
}

/** One weapon profile. `cc`, `s` and `l` are [range, modifier, damage] or null when the weapon has no such profile. */
export interface Weapon {
  n: string;
  tr: string[]; // trait labels as printed
  trk: string[]; // trait keys
  trp: string[][]; // trait parameters
  cc: string[] | null;
  s: string[] | null;
  l: string[] | null;
  cf: string;
}

export interface Unit {
  id: string;
  f: string; // faction id
  n: string; // name
  v: string; // variant
  ty: string; // unit type key
  dg: Designation;
  ally: AllyDesignation | null;
  dp: number;
  sp: number; // positive gives Support points, negative spends them
  rq: { c: number; t: string[] } | null; // needs c Troopers of one of these types per copy
  ak: string[]; // ability keys
  ap: string[][]; // ability parameters
  a: string[]; // ability labels as printed
  wn: string[]; // weapon names
  ar: number;
  ch: string[]; // MV MW CC ST DEF AR W PW LD
  w: Weapon[];
}

export interface AssetTarget {
  any?: boolean;
  ability?: string;
  designation?: string;
  unitType?: string;
  weaponName?: string;
  weaponNameContains?: string;
  maxCharacteristic?: Record<string, number>;
}

export interface Asset {
  id: string;
  n: string;
  dp: number;
  fs: string[]; // faction ids it is limited to
  gs: string[]; // faction groups it is limited to
  tg: AssetTarget | null; // null: applies to the whole force
  fx: string; // effect text
}

interface AllyRule {
  sourceGroup: string;
  forbiddenIfForceGroupIn: string[];
  requiresAllegiance: Allegiance | null;
  singleSourceFaction?: boolean;
}

export interface GameData {
  factions: Faction[];
  allegiances: Allegiance[];
  allyDesignations: Record<AllyDesignation, AllyRule>;
  gameSizes: [number, string][];
  allyShare: number;
  typeNames: Record<string, string>;
  units: Unit[];
  assets: Asset[];
}

export const DATA = rawData as unknown as GameData;

export const STAT_KEYS = ["MV", "MW", "CC", "ST", "DEF", "AR", "W", "PW", "LD"] as const;

// The data has one duplicated id (cybertronic_dr_diana_base, Leader and Specialist). Like the original
// builder, the first entry wins.
const unitIndex = new Map<string, Unit>();
DATA.units.forEach((u) => unitIndex.has(u.id) || unitIndex.set(u.id, u));
const assetIndex = new Map(DATA.assets.map((a) => [a.id, a]));
export const unitById = (id: string) => unitIndex.get(id);
export const assetById = (id: string) => assetIndex.get(id);

export function factionGroup(fid: string): string | null {
  return DATA.factions.find((x) => x.id === fid)?.group ?? null;
}

export function factionName(fid: string): string {
  return DATA.factions.find((x) => x.id === fid)?.name ?? fid;
}

export function typeName(ty: string): string {
  return DATA.typeNames[ty] || ty;
}

/** The faction's own units. */
export function rosterUnits(fid: string): Unit[] {
  return DATA.units.filter((u) => u.f === fid && !u.ally);
}

/** Ally eligibility per DATA.allyDesignations: source group, forbidden force groups, and required allegiance. */
export function allyUnits(fid: string, allegiance: Allegiance): Unit[] {
  const group = factionGroup(fid);
  return DATA.units.filter((u) => {
    if (!u.ally) return false;
    const rule = DATA.allyDesignations[u.ally];
    if (!rule) return false;
    if (factionGroup(u.f) !== rule.sourceGroup) return false;
    if (group && rule.forbiddenIfForceGroupIn.includes(group)) return false;
    if (rule.requiresAllegiance && rule.requiresAllegiance !== allegiance) return false;
    return true;
  });
}

export function assetsFor(fid: string): Asset[] {
  const group = factionGroup(fid);
  return DATA.assets.filter((a) => {
    if (a.fs.length) return a.fs.includes(fid);
    if (a.gs.length) return group !== null && a.gs.includes(group);
    return true;
  });
}

/** Units in the force that can legally carry an asset, per its target clause. */
export function eligibleTargets(asset: Asset, forceUnits: Unit[]): Unit[] {
  const tg = asset.tg;
  if (!tg) return [];
  return forceUnits.filter((u) => {
    if (tg.any) return true;
    if (tg.ability && !u.ak.includes(tg.ability)) return false;
    if (tg.designation && u.dg !== tg.designation) return false;
    if (tg.unitType && u.ty !== tg.unitType) return false;
    if (tg.weaponName && !u.wn.includes(tg.weaponName)) return false;
    if (tg.weaponNameContains && !u.wn.some((n) => n.includes(tg.weaponNameContains!))) return false;
    if (tg.maxCharacteristic) {
      const k = Object.keys(tg.maxCharacteristic)[0];
      if (k === "ar" && u.ar > tg.maxCharacteristic.ar) return false;
    }
    return true;
  });
}

const cap = (s: string) => String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Human-readable requirement for an asset's target clause. */
export function targetRequirement(asset: Asset, lang: Lang = "en"): string {
  const tg = asset.tg;
  const en = lang !== "pl";
  if (!tg) return en ? "No target — applies to the force" : "Bez celu — dotyczy Siły";
  if (tg.any) return en ? "any unit in the force" : "dowolna jednostka w Sile";
  const parts: string[] = [];
  if (tg.designation) parts.push((en ? "the " : "desygnacja ") + cap(tg.designation) + (en ? " designation" : ""));
  if (tg.ability) parts.push((en ? "the " : "zdolność ") + cap(tg.ability) + (en ? " ability" : ""));
  if (tg.unitType) parts.push((en ? "unit type " : "typ oddziału ") + typeName(tg.unitType));
  if (tg.weaponName) parts.push((en ? "the weapon " : "broń ") + tg.weaponName);
  if (tg.weaponNameContains) parts.push((en ? "a weapon named “…" : "broń o nazwie „…") + tg.weaponNameContains + "”");
  if (tg.maxCharacteristic) {
    const k = Object.keys(tg.maxCharacteristic)[0];
    parts.push((en ? k.toUpperCase() + " of " : k.toUpperCase() + " co najwyżej ") + tg.maxCharacteristic[k] + (en ? " or less" : ""));
  }
  return parts.join(en ? " and " : " i ");
}

/** unit id → copies in the force */
export type ForceCounts = Record<string, number>;
/** asset id → copies taken */
export type KitCounts = Record<string, number>;

function countTroopersOfTypes(force: ForceCounts, types: string[]): number {
  return DATA.units
    .filter((u) => types.includes(u.ty) && u.dg === "trooper" && force[u.id])
    .reduce((n, u) => n + force[u.id], 0);
}

export interface Issue {
  code:
    | "no_leader"
    | "specialist_requirement"
    | "leader_requirement"
    | "unique_duplicate"
    | "dp_over_limit"
    | "sp_overspent"
    | "ally_share_exceeded"
    | "asset_no_target"
    | "ally_not_allowed";
  sev: "error" | "warn";
  text: string;
}

export interface Validation {
  issues: Issue[];
  dp: number;
  unitDp: number;
  kitDp: number;
  unitCount: number;
  allyDp: number;
  allyLimit: number;
  spAvail: number;
  spSpent: number;
  sp: number;
  leaders: number;
}

/** Why an ally can't join this force, or null when it can. Mirrors allyUnits(). */
function allyBlock(u: Unit, fid: string, allegiance: Allegiance, en: boolean): string | null {
  const rule = u.ally ? DATA.allyDesignations[u.ally] : undefined;
  if (!rule) return null;
  const kind = cap(u.ally!);
  if (rule.requiresAllegiance && rule.requiresAllegiance !== allegiance) {
    return en
      ? `${kind} allies can only join ${ALLEGIANCE_LABEL[rule.requiresAllegiance]} forces`
      : `sojusznicy ${kind} mogą dołączyć tylko do Sił ${ALLEGIANCE_LABEL[rule.requiresAllegiance]}`;
  }
  const group = factionGroup(fid);
  if (factionGroup(u.f) !== rule.sourceGroup || (group && rule.forbiddenIfForceGroupIn.includes(group))) {
    return en ? `${kind} allies can't join a ${factionName(fid)} force` : `sojusznicy ${kind} nie mogą dołączyć do Siły ${factionName(fid)}`;
  }
  return null;
}

export function validate(
  force: ForceCounts,
  kit: KitCounts,
  fid: string,
  gameSize: number,
  allegiance: Allegiance,
  lang: Lang = "en",
): Validation {
  const en = lang !== "pl";
  const issues: Issue[] = [];
  const inForce = DATA.units.filter((u) => force[u.id]);
  const qty = (u: Unit) => force[u.id] || 0;
  const unitCount = inForce.reduce((n, u) => n + qty(u), 0);
  const unitDp = inForce.reduce((n, u) => n + qty(u) * u.dp, 0);
  const kitDp = Object.keys(kit).reduce((n, id) => n + (assetById(id)?.dp ?? 0) * kit[id], 0);
  const dp = unitDp + kitDp;
  const allyDp = inForce.filter((u) => u.ally).reduce((n, u) => n + qty(u) * u.dp, 0);
  const allyLimit = Math.floor(gameSize * DATA.allyShare);
  const spAvail = inForce.reduce((n, u) => n + qty(u) * Math.max(0, u.sp), 0);
  const spSpent = inForce.reduce((n, u) => n + qty(u) * Math.max(0, -u.sp), 0);
  const leaders = inForce.filter((u) => u.dg === "leader").reduce((n, u) => n + qty(u), 0);

  if (unitCount > 0 && leaders === 0) {
    issues.push({ code: "no_leader", sev: "error", text: en ? "The force has no Leader" : "Siła nie ma Dowódcy" });
  }
  inForce.forEach((u) => {
    const label = (u.n + " " + u.v).trim();
    if (u.rq) {
      const have = countTroopersOfTypes(force, u.rq.t);
      const need = u.rq.c * qty(u);
      if (have < need) {
        const types = u.rq.t.map(typeName).join(en ? " or " : " lub ");
        issues.push({
          code: u.dg === "specialist" ? "specialist_requirement" : "leader_requirement",
          sev: "error",
          text: en
            ? `${label} needs ${need} × Trooper of type ${types}, ${have} available`
            : `${label} wymaga ${need} × Szeregowego typu ${types}, dostępnych ${have}`,
        });
      }
    }
    if (u.ally) {
      const why = allyBlock(u, fid, allegiance, en);
      if (why) issues.push({ code: "ally_not_allowed", sev: "error", text: `${label}: ${why}` });
    }
    if (u.dg === "unique" && qty(u) > 1) {
      issues.push({
        code: "unique_duplicate",
        sev: "error",
        text: en ? `${label} is Unique — only one may be taken` : `${label} to Unikat — można wziąć tylko jednego`,
      });
    }
  });
  if (dp > gameSize) {
    issues.push({
      code: "dp_over_limit",
      sev: "error",
      text: en ? `Force is ${dp - gameSize} DP over the ${gameSize} DP limit` : `Siła przekracza limit ${gameSize} DP o ${dp - gameSize}`,
    });
  }
  if (spSpent > spAvail) {
    issues.push({
      code: "sp_overspent",
      sev: "warn",
      text: en ? `Force overspends Support points by ${spSpent - spAvail}` : `Siła przekracza Punkty wsparcia o ${spSpent - spAvail}`,
    });
  }
  if (allyDp > allyLimit) {
    issues.push({
      code: "ally_share_exceeded",
      sev: "error",
      text: en ? `Allies use ${allyDp} DP, above the ${allyLimit} DP cap` : `Sojusznicy zajmują ${allyDp} DP, powyżej limitu ${allyLimit} DP`,
    });
  }
  Object.keys(kit).forEach((id) => {
    const a = assetById(id);
    if (!a) return;
    if (a.tg && eligibleTargets(a, inForce).length === 0) {
      issues.push({
        code: "asset_no_target",
        sev: "error",
        text: en ? `${a.n} has no eligible unit in the force` : `${a.n} nie ma w Sile jednostki spełniającej warunek`,
      });
    }
  });

  return { issues, dp, unitDp, kitDp, unitCount, allyDp, allyLimit, spAvail, spSpent, sp: spAvail - spSpent, leaders };
}

const ABILITY_TEXT: Record<string, string[]> = rulesText.abilities;
const TRAIT_TEXT: Record<string, string[]> = rulesText.traits;

function fill(txt: string, params?: string[]): string {
  if (!params || !params.length) return txt;
  return txt
    .split("+X").join("+" + params[0])
    .split("X").join(params[0])
    .split("the listed type").join(params[0])
    .split("wskazanego typu").join(params[0]);
}

/** Rules text for a special ability, or null when the extracted data doesn't have it yet. */
export function abilityText(key: string, lang: Lang = "en", params?: string[]): string | null {
  const e = ABILITY_TEXT[key];
  return e ? fill(lang === "pl" ? e[1] : e[0], params) : null;
}

/** Rules text for a weapon trait, or null when the extracted data doesn't have it yet. */
export function traitText(key: string, lang: Lang = "en", params?: string[]): string | null {
  const e = TRAIT_TEXT[key];
  return e ? fill(lang === "pl" ? e[1] : e[0], params) : null;
}
