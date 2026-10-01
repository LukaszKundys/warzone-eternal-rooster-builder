import { ALLEGIANCE_LABEL } from "../lib/types";
import { useBuilder } from "./context";
import { t } from "./copy";
import { PLAYABLE_FACTIONS } from "./force";
import { DATA, type Allegiance } from "./rules";

/** Faction, game size and allegiance. Changing faction empties the force, so it asks first. */
export function SetupFields() {
  const { force, dispatch } = useBuilder();
  const hasContent = force.units.length + force.forceAssets.length > 0;
  return (
    <div className="setup-fields">
      <label className="setup-field">
        <span>{t.faction}</span>
        <select
          value={force.faction}
          onChange={(e) => {
            if (hasContent && !window.confirm("Changing faction removes every unit and asset from this force. Continue?")) return;
            dispatch({ type: "setFaction", faction: e.target.value });
          }}
        >
          {PLAYABLE_FACTIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label className="setup-field">
        <span>{t.gameSize}</span>
        <select value={force.gameSize} onChange={(e) => dispatch({ type: "setGameSize", gameSize: Number(e.target.value) })}>
          {DATA.gameSizes.map(([n, k]) => <option key={n} value={n}>{n} DP — {t.sizes[k]}</option>)}
        </select>
      </label>
      <label className="setup-field">
        <span>{t.allegiance}</span>
        <select value={force.allegiance} onChange={(e) => dispatch({ type: "setAllegiance", allegiance: e.target.value as Allegiance })}>
          {DATA.allegiances.map((a) => <option key={a} value={a}>{ALLEGIANCE_LABEL[a]}</option>)}
        </select>
      </label>
    </div>
  );
}
