import { useEffect, type ReactNode } from "react";
import { spText, spTone, unitMeta, useBuilder } from "./context";
import { t } from "./copy";
import { MAX_UNITS } from "./force";
import { assetById, eligibleTargets, factionName, targetRequirement, typeName, unitById } from "./rules";
import { UnitProfile } from "./UnitProfile";

/** Bottom sheet on mobile, centred dialog on desktop. Escape or the backdrop closes it. */
function Sheet({ wide, label, onClose, children }: { wide: boolean; label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={wide ? "sheet-backdrop modal" : "sheet-backdrop"} onClick={onClose}>
      <div className="scroll sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function SheetHead({ title, sub, onClose, cost }: { title: ReactNode; sub: string; onClose: () => void; cost: ReactNode }) {
  return (
    <div className="sheet-head">
      <div className="sheet-bar" />
      <div className="sheet-title">
        <h2>{title}</h2>
        <div className="meta">{sub}</div>
      </div>
      {cost}
      <button className="icon-btn lg" aria-label={t.close} onClick={onClose}>✕</button>
    </div>
  );
}

export function UnitPeek({ id, wide }: { id: string; wide: boolean }) {
  const { force, qty, dispatch, peekUnit } = useBuilder();
  const u = unitById(id);
  if (!u) return null;
  const close = () => peekUnit(null);
  const canAdd = !(u.dg === "unique" && qty[u.id]) && force.units.length < MAX_UNITS;
  return (
    <Sheet wide={wide} label={`${u.n} ${u.v}`.trim()} onClose={close}>
      <SheetHead
        title={<>{u.n} <span className="variant">{u.v}</span></>}
        sub={unitMeta(u)}
        onClose={close}
        cost={
          <div className="cat-row-cost">
            <div className="dp">{u.dp}<small>DP</small></div>
            <div className={`sp ${spTone(u.sp)}`}>{spText(u.sp)}<small>SP</small></div>
          </div>
        }
      />
      <UnitProfile unit={u} />
      <div className="sheet-foot">
        {canAdd ? (
          <button className="btn-gold" onClick={() => { dispatch({ type: "add", unit: u.id }); if (wide) close(); }}>{t.addToForce}</button>
        ) : (
          <div className="note-box ok">{t.uniqueTaken}</div>
        )}
      </div>
    </Sheet>
  );
}

export function AssetPeek({ id, wide }: { id: string; wide: boolean }) {
  const { force, qty, kit, inForce, dispatch, peekAsset } = useBuilder();
  const a = assetById(id);
  if (!a) return null;
  const close = () => peekAsset(null);
  const targets = eligibleTargets(a, inForce);
  const req = targetRequirement(a);
  const taken = (kit[a.id] || 0) > 0;
  const ok = new Set(targets.map((u) => u.id));
  const seen: Record<string, number> = {};
  const choices = force.units.filter((x) => ok.has(x.u)).map((x) => {
    const u = unitById(x.u)!;
    seen[x.u] = (seen[x.u] || 0) + 1;
    return {
      i: x.i,
      label: `${u.n}${u.v ? " " + u.v : ""}${qty[x.u] > 1 ? " #" + seen[x.u] : ""}`,
      sub: x.k.length ? `${x.k.length} ${x.k.length === 1 ? "asset attached" : "assets attached"}` : typeName(u.ty),
    };
  });
  const target = !a.tg ? t.assetForce : targets.length ? t.assetOk(targets.reduce((n, u) => n + qty[u.id], 0), req) : t.assetNone(req);

  return (
    <Sheet wide={wide} label={a.n} onClose={close}>
      <SheetHead
        title={a.n}
        sub={`${factionName(force.faction)} · ${a.fs.length ? "faction asset" : "group asset"}`}
        onClose={close}
        cost={<div className="cost-box single"><div><small>DP</small>{a.dp}</div></div>}
      />
      <div className="sheet-body">
        <div className="rule-text">
          <div className="section-k gold">{t.assetEffectHead}</div>
          <div className="rule-text-body">{a.fx || t.assetNoText}</div>
        </div>
        <div className="plain-box">
          <div className="section-k">{t.assetTargetHead}</div>
          <div>{target}</div>
        </div>
        {taken && <div className="note-box ok left"><span>✓</span>{t.assetTaken}</div>}
        {a.tg && !taken && (
          <div>
            <div className="section-k ok">{t.assignHead}</div>
            <div className="choices">
              {choices.map((c) => (
                <button key={c.i} className="choice" onClick={() => { dispatch({ type: "attach", asset: a.id, i: c.i }); close(); }}>
                  <span className="choice-name">{c.label}</span>
                  <span className="meta">{c.sub}</span>
                  <span className="plus">+</span>
                </button>
              ))}
            </div>
            {choices.length === 0 && <div className="note-box bad">{t.assignNone}</div>}
          </div>
        )}
        {!a.tg && !taken && (
          <button className="btn-gold" onClick={() => { dispatch({ type: "addForceAsset", asset: a.id }); close(); }}>{t.assetAdd}</button>
        )}
      </div>
    </Sheet>
  );
}
