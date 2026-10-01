import type { ListDraft, SavedList } from "../lib/types";
import { DATA, assetById, eligibleTargets, factionName, unitById, validate, type Allegiance, type ForceCounts, type KitCounts } from "./rules";

/** Most units a force can hold; matches the design's cap. */
export const MAX_UNITS = 40;

/** One copy of a unit in the force, with the assets attached to it. `i` is a per-force id. */
export interface UnitEntry {
  i: number;
  u: string;
  k: string[];
}

/** An asset that applies to the whole force rather than to one unit. */
export interface ForceAssetEntry {
  i: number;
  a: string;
}

export interface Force {
  faction: string;
  gameSize: number;
  allegiance: Allegiance;
  units: UnitEntry[];
  forceAssets: ForceAssetEntry[];
  seq: number;
}

/** Stored in `lists.roster`. Bump `v` if the shape changes. */
export interface StoredRoster {
  v: 1;
  faction: string;
  gameSize: number;
  allegiance: Allegiance;
  units: { u: string; k: string[] }[];
  forceAssets: string[];
}

export const PLAYABLE_FACTIONS = DATA.factions.filter((f) => f.status !== "partial");

export const emptyForce = (): Force => ({
  faction: PLAYABLE_FACTIONS[0].id,
  gameSize: 40,
  allegiance: "agents_of_light",
  units: [],
  forceAssets: [],
  seq: 1,
});

export const counts = (f: Force) => {
  const force: ForceCounts = {};
  f.units.forEach((x) => (force[x.u] = (force[x.u] || 0) + 1));
  const kit: KitCounts = {};
  f.units.forEach((x) => x.k.forEach((a) => (kit[a] = (kit[a] || 0) + 1)));
  f.forceAssets.forEach((x) => (kit[x.a] = (kit[x.a] || 0) + 1));
  return { force, kit };
};

/** An Asset may be purchased only once per Force. */
export const hasAsset = (f: Force, aid: string) => f.forceAssets.some((x) => x.a === aid) || f.units.some((x) => x.k.includes(aid));

export type ForceAction =
  | { type: "add"; unit: string }
  | { type: "remove"; i: number }
  | { type: "attach"; asset: string; i: number }
  | { type: "detach"; i: number; index: number }
  | { type: "addForceAsset"; asset: string }
  | { type: "removeForceAsset"; i: number }
  | { type: "setFaction"; faction: string }
  | { type: "setGameSize"; gameSize: number }
  | { type: "setAllegiance"; allegiance: Allegiance }
  | { type: "clear" }
  | { type: "load"; force: Force };

export function forceReducer(f: Force, action: ForceAction): Force {
  switch (action.type) {
    case "add": {
      const u = unitById(action.unit);
      if (!u || f.units.length >= MAX_UNITS) return f;
      if (u.dg === "unique" && f.units.some((x) => x.u === u.id)) return f;
      return { ...f, units: [...f.units, { i: f.seq, u: u.id, k: [] }], seq: f.seq + 1 };
    }
    case "remove":
      return { ...f, units: f.units.filter((x) => x.i !== action.i) };
    case "attach": {
      const a = assetById(action.asset);
      const target = f.units.find((x) => x.i === action.i);
      const u = target && unitById(target.u);
      if (!a || !a.tg || !u || hasAsset(f, a.id) || eligibleTargets(a, [u]).length === 0) return f;
      return { ...f, units: f.units.map((x) => (x.i === action.i ? { ...x, k: [...x.k, a.id] } : x)) };
    }
    case "detach":
      return { ...f, units: f.units.map((x) => (x.i === action.i ? { ...x, k: x.k.filter((_, j) => j !== action.index) } : x)) };
    case "addForceAsset": {
      const a = assetById(action.asset);
      if (!a || a.tg || hasAsset(f, a.id)) return f;
      return { ...f, forceAssets: [...f.forceAssets, { i: f.seq, a: a.id }], seq: f.seq + 1 };
    }
    case "removeForceAsset":
      return { ...f, forceAssets: f.forceAssets.filter((x) => x.i !== action.i) };
    case "setFaction":
      // Units and assets belong to a faction, so changing it starts the force over.
      return action.faction === f.faction ? f : { ...f, faction: action.faction, units: [], forceAssets: [] };
    case "setGameSize":
      return { ...f, gameSize: action.gameSize };
    case "setAllegiance":
      return { ...f, allegiance: action.allegiance };
    case "clear":
      return { ...f, units: [], forceAssets: [] };
    case "load":
      return action.force;
  }
}

export const sizeName = (dp: number) => {
  const k = DATA.gameSizes.find(([n]) => n === dp)?.[1] ?? "custom";
  return k.charAt(0).toUpperCase() + k.slice(1);
};

export function toStored(f: Force): StoredRoster {
  return {
    v: 1,
    faction: f.faction,
    gameSize: f.gameSize,
    allegiance: f.allegiance,
    units: f.units.map(({ u, k }) => ({ u, k })),
    forceAssets: f.forceAssets.map((x) => x.a),
  };
}

/** The list row for a force: summary columns for My Lists plus the full roster. */
export function toDraft(name: string, f: Force): ListDraft {
  const { force, kit } = counts(f);
  const v = validate(force, kit, f.gameSize);
  return {
    name,
    faction: factionName(f.faction),
    allegiance: f.allegiance,
    gameSize: sizeName(f.gameSize),
    points: v.dp,
    limit: f.gameSize,
    unitCount: v.unitCount,
    roster: toStored(f),
  };
}

const isStored = (r: unknown): r is StoredRoster => !!r && typeof r === "object" && (r as StoredRoster).v === 1;

/**
 * Rebuild a force from a saved list. Lists saved before the builder existed have no roster,
 * so their faction and size come from the summary columns. Unknown unit or asset ids are dropped.
 */
export function fromList(l: SavedList): Force {
  const base = emptyForce();
  if (!isStored(l.roster)) {
    const faction = PLAYABLE_FACTIONS.find((x) => x.name === l.faction)?.id ?? base.faction;
    const gameSize = DATA.gameSizes.some(([n]) => n === l.limit) ? l.limit : base.gameSize;
    return { ...base, faction, gameSize, allegiance: l.allegiance };
  }
  const r = l.roster;
  let seq = 1;
  const units: UnitEntry[] = r.units
    .filter((x) => unitById(x.u))
    .map((x) => ({ i: seq++, u: x.u, k: x.k.filter((a) => assetById(a)) }));
  const forceAssets: ForceAssetEntry[] = r.forceAssets.filter((a) => assetById(a)).map((a) => ({ i: seq++, a }));
  return { faction: r.faction, gameSize: r.gameSize, allegiance: r.allegiance, units, forceAssets, seq };
}

export const sameForce = (a: Force, b: Force) => JSON.stringify(toStored(a)) === JSON.stringify(toStored(b));
