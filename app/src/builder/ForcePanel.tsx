import { spText, spTone, unitMeta, useBuilder } from "./context";
import { t } from "./copy";
import { MAX_UNITS } from "./force";
import { assetById, unitById } from "./rules";
import { UnitProfile } from "./UnitProfile";

/** The force as a stack of printed unit cards, plus assets that apply to the whole force. */
export function ForcePanel({ wide }: { wide: boolean }) {
  const { force, qty, v, dispatch } = useBuilder();
  const seen: Record<string, number> = {};
  const full = force.units.length >= MAX_UNITS;

  return (
    <div className="force">
      {wide && (
        <div className="col-title padded">
          <h2>{t.nav.force}</h2>
          <span>{t.rosterLine(v.unitCount, v.dp, force.gameSize)}</span>
        </div>
      )}
      <div className="scroll force-list">
        {force.units.map((x) => {
          const u = unitById(x.u);
          if (!u) return null;
          seen[x.u] = (seen[x.u] || 0) + 1;
          const label = `${u.n} ${u.v}`.trim() + (qty[x.u] > 1 ? ` #${seen[x.u]}` : "");
          const actions = (
            <>
              {u.dg !== "unique" && (
                <button className="btn-quiet" disabled={full} onClick={() => dispatch({ type: "add", unit: u.id })}>{t.duplicate}</button>
              )}
              <button className="btn-danger-quiet" aria-label={`Remove ${label}`} onClick={() => dispatch({ type: "remove", i: x.i })}>
                {wide ? "✕" : t.remove}
              </button>
            </>
          );
          return (
            <article key={x.i} className="unit-card" aria-label={label}>
              <div className="stripe" />
              <div className="unit-card-main">
                <div className="unit-card-head">
                  <div className="unit-card-title">
                    <h3>{u.n} <span className="variant">{u.v}</span> {qty[x.u] > 1 && <span className="inst">#{seen[x.u]}</span>}</h3>
                    <div className="meta">{unitMeta(u)}</div>
                  </div>
                  <div className="cost-box">
                    <div><small>DP</small>{u.dp}</div>
                    <div className={`sp ${spTone(u.sp)}`}><small>SP</small>{spText(u.sp)}</div>
                  </div>
                  {wide && <div className="unit-card-actions">{actions}</div>}
                </div>
                <UnitProfile unit={u} />
                {x.k.length > 0 && (
                  <div className="kit">
                    <div className="section-k ok">{t.attached}</div>
                    {x.k.map((aid, ki) => (
                      <span key={ki} className="kit-chip">
                        {assetById(aid)?.n ?? aid}
                        <button aria-label={`Detach ${assetById(aid)?.n ?? aid}`} onClick={() => dispatch({ type: "detach", i: x.i, index: ki })}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                {!wide && <div className="unit-card-foot">{actions}</div>}
              </div>
            </article>
          );
        })}

        {force.forceAssets.length > 0 && (
          <section className="force-assets">
            <div className="section-k ok">{t.forceAssetsHead}</div>
            {force.forceAssets.map((x) => {
              const a = assetById(x.a);
              return (
                <div key={x.i} className="force-asset">
                  <div className="force-asset-text">
                    <div className="force-asset-name">{a?.n ?? x.a}</div>
                    <div className="force-asset-fx">{a?.fx}</div>
                  </div>
                  <div className="force-asset-dp">{a?.dp ?? 0} DP</div>
                  <button className="btn-danger-quiet square" aria-label={`Remove ${a?.n ?? x.a}`} onClick={() => dispatch({ type: "removeForceAsset", i: x.i })}>✕</button>
                </div>
              );
            })}
          </section>
        )}

        {force.units.length === 0 && force.forceAssets.length === 0 && (
          <div className="empty-box tall">
            <div className="empty-box-title">{t.rosterEmptyTitle}</div>
            <div className="empty-box-body">{wide ? t.rosterEmptyBody : t.rosterEmptyBodyMobile}</div>
          </div>
        )}
      </div>
    </div>
  );
}
