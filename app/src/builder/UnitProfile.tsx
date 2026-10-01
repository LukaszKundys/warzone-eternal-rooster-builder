import { Fragment, useState } from "react";
import { t } from "./copy";
import { STAT_KEYS, abilityText, traitText, type Unit } from "./rules";

/** Characteristics, weapon table and special abilities, as printed on a unit card. */
export function UnitProfile({ unit: u }: { unit: Unit }) {
  // "a:<ability key>" or "t:<weapon index>:<trait key>"
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (tag: string) => setOpen((cur) => (cur === tag ? null : tag));

  let panel: { label: string; text: string; pending: boolean } | null = null;
  if (open?.startsWith("a:")) {
    const i = u.ak.indexOf(open.slice(2));
    const txt = abilityText(u.ak[i], "en", u.ap[i]);
    panel = { label: u.a[i], text: txt ?? t.abilityPending, pending: !txt };
  } else if (open?.startsWith("t:")) {
    const [, wi, key] = open.split(":");
    const w = u.w[Number(wi)];
    const ti = w.trk.indexOf(key);
    const txt = traitText(key, "en", w.trp[ti]);
    panel = { label: w.tr[ti], text: txt ?? t.traitPending, pending: !txt };
  }

  const cell = (b: string[] | null, i: number) =>
    b ? <div className="wcell">{b[i] || "—"}</div> : <div className="wcell dash">—</div>;

  return (
    <>
      <div className="stats">
        {STAT_KEYS.map((k, i) => (
          <div key={k} className="stat">
            <div className="stat-k">{k}</div>
            <div className="stat-v">{u.ch[i]}</div>
          </div>
        ))}
      </div>

      <div className="profile-body">
        <div className="weapons">
          <div className="whead cc">{t.ccHead}</div>
          <div className="whead rng">{t.shortHead}</div>
          <div className="whead rng">{t.longHead}</div>
          <div className="whead">CF</div>
          {u.w.map((w, wi) => (
            <Fragment key={wi}>
              <div className="wname-row">
                <div className="wname">{w.n}</div>
                {w.tr.map((label, ti) => {
                  const tag = `t:${wi}:${w.trk[ti]}`;
                  return (
                    <button key={ti} className="trait" aria-pressed={open === tag} onClick={() => toggle(tag)}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {cell(w.cc, 1)}
              {cell(w.cc, 2)}
              {cell(w.s, 0)}
              {cell(w.s, 1)}
              {cell(w.s, 2)}
              {cell(w.l, 0)}
              {cell(w.l, 1)}
              {cell(w.l, 2)}
              <div className="wcell">{w.cf}</div>
            </Fragment>
          ))}
        </div>

        <div className="abilities">
          <div className="section-k gold">{t.abilities}</div>
          <div className="ability-chips">
            {u.a.map((label, i) => {
              const tag = `a:${u.ak[i]}`;
              return (
                <button key={i} className="ability" aria-pressed={open === tag} onClick={() => toggle(tag)}>
                  <span className="dot" />
                  {label}
                </button>
              );
            })}
          </div>
          {panel && (
            <div className="rule-text">
              <div className="rule-text-head">
                <div className="rule-text-label">{panel.label}</div>
                <button className="icon-btn" aria-label={t.close} onClick={() => setOpen(null)}>✕</button>
              </div>
              <div className={panel.pending ? "rule-text-body pending" : "rule-text-body"}>{panel.text}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
