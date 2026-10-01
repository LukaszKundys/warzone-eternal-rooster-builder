import { useState } from "react";
import { spText, spTone, unitMeta, desigLabel, useBuilder } from "./context";
import { t } from "./copy";
import { MAX_UNITS } from "./force";
import {
  allyUnits, assetsFor, eligibleTargets, factionName, rosterUnits, targetRequirement, typeName,
  type Asset, type Designation, type Unit,
} from "./rules";

type Tab = "units" | "allies" | "assets";
const DESIGNATIONS: Designation[] = ["trooper", "leader", "specialist", "support", "unique"];

interface Row {
  key: string;
  name: string;
  variant: string;
  meta: string;
  dp: number;
  sp: number;
  qty: number;
  canAdd: boolean;
  blocked: boolean;
  tone: "open" | "taken" | "blocked";
  reason?: { mark: string; text: string; tone: "ok" | "muted" };
  peek: () => void;
  add: () => void;
}

/**
 * Units, allies and assets the force can take. Keyed by faction in the parent, so search and
 * filters reset when the faction changes. `wide` adds unit-type filters (desktop layout).
 */
export function Catalogue({ wide }: { wide: boolean }) {
  const b = useBuilder();
  const { force, qty, kit, inForce } = b;
  const [tab, setTab] = useState<Tab>("units");
  const [q, setQ] = useState("");
  const [desig, setDesig] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const toggle = (list: string[], set: (l: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const query = q.trim().toLowerCase();
  const match = (u: Unit) =>
    (!query || `${u.n} ${u.v} ${typeName(u.ty)} ${u.a.join(" ")} ${desigLabel(u)}`.toLowerCase().includes(query)) &&
    (!desig.length || desig.includes(u.dg)) &&
    (!types.length || types.includes(u.ty));

  const own = rosterUnits(force.faction);
  const unitList = own.filter(match);
  const allyList = allyUnits(force.faction, force.allegiance).filter(match);
  const assetList = assetsFor(force.faction).filter((a) => !query || a.n.toLowerCase().includes(query));
  const full = force.units.length >= MAX_UNITS;

  const unitRow = (u: Unit): Row => {
    const n = qty[u.id] || 0;
    const uniqueTaken = u.dg === "unique" && n > 0;
    return {
      key: u.id + u.dg, name: u.n, variant: u.v, meta: unitMeta(u), dp: u.dp, sp: u.sp, qty: n,
      canAdd: !uniqueTaken && !full, blocked: false, tone: n ? "taken" : "open",
      reason: uniqueTaken ? { mark: "✓", text: t.uniqueTaken, tone: "ok" } : undefined,
      peek: () => b.peekUnit(u.id),
      add: () => b.dispatch({ type: "add", unit: u.id }),
    };
  };

  const groups: { heading?: string; rows: Row[] }[] = [];
  if (tab === "units") groups.push({ rows: unitList.map(unitRow) });
  if (tab === "allies") {
    groups.push({
      rows: allyList.map((u) => ({ ...unitRow(u), reason: { mark: "✓", text: t.allyOk(t.allyDesig[u.ally!], factionName(u.f)), tone: "ok" } })),
    });
  }
  if (tab === "assets") {
    const ok: Row[] = [];
    const bad = new Map<string, Row[]>();
    assetList.forEach((a: Asset) => {
      const targets = eligibleTargets(a, inForce);
      const req = targetRequirement(a);
      const taken = (kit[a.id] || 0) > 0;
      const blocked = taken || (!!a.tg && targets.length === 0);
      const r: Row = {
        key: a.id, name: a.n, variant: "", meta: `${factionName(force.faction)} · ${a.fs.length ? "faction asset" : "group asset"}`,
        dp: a.dp, sp: 0, qty: kit[a.id] || 0, canAdd: !blocked, blocked,
        tone: taken ? "taken" : blocked ? "blocked" : "open",
        peek: () => b.peekAsset(a.id),
        add: () => (a.tg ? b.peekAsset(a.id) : b.dispatch({ type: "addForceAsset", asset: a.id })),
      };
      if (taken) ok.push({ ...r, reason: { mark: "✓", text: t.assetTakenShort, tone: "ok" } });
      else if (blocked) {
        const why = t.assetNone(req);
        bad.set(why, [...(bad.get(why) ?? []), r]);
      } else {
        const n = targets.reduce((x, u) => x + qty[u.id], 0);
        ok.push({ ...r, reason: { mark: "✓", text: a.tg ? t.assetOk(n, req) : t.assetForce, tone: "muted" } });
      }
    });
    groups.push({ rows: ok });
    bad.forEach((rows, heading) => groups.push({ heading, rows }));
  }
  const shown = groups.reduce((n, g) => n + g.rows.length, 0);

  const presentDesig = DESIGNATIONS.filter((d) => own.some((u) => u.dg === d));
  const presentTypes = [...new Set(own.map((u) => u.ty))];
  const anyFilter = desig.length + types.length > 0;

  return (
    <div className="catalogue">
      <div className="catalogue-head">
        {wide && (
          <div className="col-title">
            <h2>{t.nav.catalogue}</h2>
            <span>{t.catalogueLine(shown)}</span>
          </div>
        )}
        <div className="cat-search">
          <span aria-hidden="true">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPh} aria-label="Search the catalogue" />
          {q && <button className="icon-btn" aria-label="Clear search" onClick={() => setQ("")}>✕</button>}
        </div>
        <div className={wide ? "cat-tabs wide" : "cat-tabs"} role="tablist">
          {([["units", unitList.length], ["allies", allyList.length], ["assets", assetList.length]] as const).map(([k, n]) => (
            <button key={k} role="tab" className="pill" aria-selected={tab === k} onClick={() => setTab(k)}>
              {t.tabs[k]} <span className="pill-n">{n}</span>
            </button>
          ))}
          {!wide && presentDesig.map((d) => (
            <button key={d} className="pill round" aria-pressed={desig.includes(d)} onClick={() => toggle(desig, setDesig, d)}>{t.desig[d]}</button>
          ))}
        </div>
        {wide && (
          <div className="cat-filters">
            {presentDesig.map((d) => (
              <button key={d} className="pill round" aria-pressed={desig.includes(d)} onClick={() => toggle(desig, setDesig, d)}>{t.desig[d]}</button>
            ))}
            {presentTypes.map((ty) => (
              <button key={ty} className="pill round" aria-pressed={types.includes(ty)} onClick={() => toggle(types, setTypes, ty)}>{typeName(ty)}</button>
            ))}
            {anyFilter && <button className="pill round dashed" onClick={() => { setDesig([]); setTypes([]); }}>{t.clearFilters}</button>}
          </div>
        )}
      </div>

      <div className="scroll cat-list">
        {groups.map((g, gi) => (
          <div key={gi} className="cat-group">
            {g.heading && <div className="cat-heading"><span />{g.heading}</div>}
            {g.rows.map((r) => (
              <div key={r.key} className={`cat-row ${r.tone}`}>
                <div className="stripe" />
                <div className="cat-row-main">
                  <button className="cat-row-peek" onClick={r.peek}>
                    <div className="cat-row-name">{r.name} <span className="variant">{r.variant}</span></div>
                    <div className="meta">{r.meta}</div>
                    {r.reason && (
                      <div className={`cat-reason ${r.reason.tone}`}>
                        <span className="mark">{r.reason.mark}</span>
                        <span>{r.reason.text}</span>
                      </div>
                    )}
                  </button>
                  <div className="cat-row-cost">
                    <div className="dp">{r.dp}<small>DP</small></div>
                    <div className={`sp ${spTone(r.sp)}`}>{spText(r.sp)}<small>SP</small></div>
                  </div>
                  {r.qty > 0 && <div className="cat-qty">×{r.qty}</div>}
                  {r.canAdd && (
                    <button className="add-btn" aria-label={`Add ${(r.name + " " + r.variant).trim()}`} onClick={r.add}>+</button>
                  )}
                  {r.blocked && <div className="blocked-mark" aria-hidden="true">✕</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
        {shown === 0 && (
          <div className="empty-box">
            <div className="empty-box-title">{t.emptyTitle}</div>
            <div className="empty-box-body">{t.emptyBody}</div>
          </div>
        )}
      </div>
    </div>
  );
}
