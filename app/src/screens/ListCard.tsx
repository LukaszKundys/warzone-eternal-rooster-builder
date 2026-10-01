import { relativeTime } from "../lib/time";
import { ALLEGIANCE_LABEL, type SavedList } from "../lib/types";

// Faction colours from the design; factions without one use the brand accent.
const factionAccent: Record<string, string> = { Bauhaus: "#4E8BD9", Capitol: "#D9503F", Cybertronic: "#5BC2C2" };

interface Props {
  list: SavedList;
  confirming: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}

export function ListCard({ list: l, confirming, onEdit, onDuplicate, onAskDelete, onCancelDelete, onDelete }: Props) {
  const over = l.points > l.limit;
  const pct = l.limit > 0 ? Math.min(100, Math.round((l.points / l.limit) * 100)) : 0;
  return (
    <article className="card">
      <div className="card-accent" style={{ background: factionAccent[l.faction] ?? "var(--accent)" }} />
      <div className="card-body">
        <div className="card-top">
          <div>
            <h2 className="card-name">{l.name}</h2>
            <div className="card-sub">{l.faction} · {ALLEGIANCE_LABEL[l.allegiance]}</div>
          </div>
          <div className="card-points">
            <div className="card-points-num">{l.points}</div>
            <div className="card-points-of">of {l.limit} DP</div>
          </div>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={l.limit} aria-valuenow={l.points} aria-label="Deployment points used">
          <div style={{ width: `${pct}%`, background: over ? "var(--danger)" : "var(--accent)" }} />
        </div>
        <div className="card-meta">
          <span>{l.gameSize}</span>
          <span>{l.unitCount} {l.unitCount === 1 ? "unit" : "units"}</span>
          <span>Edited {relativeTime(l.updatedAt)}</span>
        </div>
        {over && <div className="card-warn">⚠ {l.points - l.limit} DP over limit</div>}
      </div>
      {confirming ? (
        <div className="confirm">
          <span>Delete this list permanently?</span>
          <button className="cancel" onClick={onCancelDelete} autoFocus>Cancel</button>
          <button className="yes" onClick={onDelete}>Delete</button>
        </div>
      ) : (
        <div className="card-actions">
          <button className="edit" onClick={onEdit}>Edit</button>
          <button onClick={onDuplicate}>Duplicate</button>
          <button className="del" onClick={onAskDelete} aria-label={`Delete ${l.name}`}>Delete</button>
        </div>
      )}
    </article>
  );
}
