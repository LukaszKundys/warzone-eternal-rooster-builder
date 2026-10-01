import { createContext, useContext, useMemo, type Dispatch, type ReactNode } from "react";
import { t } from "./copy";
import { counts, type Force, type ForceAction } from "./force";
import { DATA, typeName, validate, type ForceCounts, type KitCounts, type Unit, type Validation } from "./rules";

export interface Builder {
  force: Force;
  dispatch: Dispatch<ForceAction>;
  /** unit id → copies */
  qty: ForceCounts;
  /** asset id → copies */
  kit: KitCounts;
  /** Distinct units in the force, in data order. */
  inForce: Unit[];
  v: Validation;
  /** Open the profile of a catalogue unit, or null to close it. */
  peekUnit: (id: string | null) => void;
  /** Open an asset's details (and its attach targets), or null to close it. */
  peekAsset: (id: string | null) => void;
}

const Ctx = createContext<Builder | null>(null);

export function BuilderProvider({
  force,
  dispatch,
  peekUnit,
  peekAsset,
  children,
}: Pick<Builder, "force" | "dispatch" | "peekUnit" | "peekAsset"> & { children: ReactNode }) {
  const value = useMemo(() => {
    const { force: qty, kit } = counts(force);
    return {
      force,
      dispatch,
      qty,
      kit,
      inForce: DATA.units.filter((u) => qty[u.id]),
      v: validate(qty, kit, force.gameSize),
      peekUnit,
      peekAsset,
    };
  }, [force, dispatch, peekUnit, peekAsset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBuilder(): Builder {
  const b = useContext(Ctx);
  if (!b) throw new Error("useBuilder must be used inside <BuilderProvider>");
  return b;
}

export const desigLabel = (u: Unit) => (u.ally ? t.allyDesig[u.ally] : t.desig[u.dg] || u.dg);
export const unitMeta = (u: Unit) => `${desigLabel(u)} · ${typeName(u.ty)}`;
export const spText = (sp: number) => (sp > 0 ? `+${sp}` : String(sp));
/** CSS modifier for a Support points value: gives, spends, or neither. */
export const spTone = (sp: number) => (sp > 0 ? "gain" : sp < 0 ? "cost" : "zero");
