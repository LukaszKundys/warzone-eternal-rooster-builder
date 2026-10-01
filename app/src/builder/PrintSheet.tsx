import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ALLEGIANCE_LABEL } from "../lib/types";
import { spText, unitMeta } from "./context";
import { t } from "./copy";
import { counts, sizeName, type Force } from "./force";
import { STAT_KEYS, abilityText, assetById, factionName, traitText, unitById, validate, type Unit } from "./rules";
import "./print.css";

/**
 * Print the force sheet (or "Save as PDF" from the print dialog). The sheet gets its own React root
 * on <body>, outside the app: opening the dialog lays the page out at paper width, which switches the
 * builder to its phone layout and would unmount anything rendered inside it. print.css hides the app
 * and shows only the sheet. It's removed once the dialog closes.
 */
export function printForce(name: string, force: Force) {
  const host = document.createElement("div");
  host.className = "print-sheet";
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<PrintSheet name={name} force={force} />));
  const done = () => {
    window.removeEventListener("afterprint", done);
    root.unmount();
    host.remove();
  };
  window.addEventListener("afterprint", done);
  window.print();
}

function PrintSheet({ name, force }: { name: string; force: Force }) {
  const { force: qty, kit } = counts(force);
  const v = validate(qty, kit, force.faction, force.gameSize, force.allegiance);

  // One entry per unit profile, in force order, with its copies and what each copy carries.
  const groups: { unit: Unit; copies: string[][] }[] = [];
  force.units.forEach((x) => {
    const unit = unitById(x.u);
    if (!unit) return;
    const g = groups.find((y) => y.unit.id === unit.id);
    if (g) g.copies.push(x.k);
    else groups.push({ unit, copies: [x.k] });
  });

  const empty = v.unitCount === 0;
  const legal = !empty && v.issues.length === 0;

  return (
    <>
      <header className="ps-head">
        <div>
          <h1>{name}</h1>
          <div className="ps-sub">
            {factionName(force.faction)} · {ALLEGIANCE_LABEL[force.allegiance]} · {force.gameSize} DP ({sizeName(force.gameSize)})
          </div>
        </div>
        <div className="ps-totals">
          <div><b>{v.dp}</b>/{force.gameSize} DP</div>
          <div><b>{v.spSpent}</b>/{v.spAvail} SP</div>
          <div>{v.unitCount} units</div>
          <div className={legal ? "ps-legal" : "ps-illegal"}>{empty ? "Empty" : legal ? "Legal" : `Not legal (${v.issues.length})`}</div>
        </div>
      </header>

      {v.issues.length > 0 && (
        <ul className="ps-issues">
          {v.issues.map((i, n) => <li key={n}>{i.sev === "error" ? "✕" : "!"} {i.text}</li>)}
        </ul>
      )}

      {groups.map(({ unit: u, copies }) => {
        const traits = u.w.flatMap((w) => w.trk.map((k, i) => ({ label: w.tr[i], text: traitText(k, "en", w.trp[i]) })));
        const seenTrait = new Set<string>();
        return (
          <section key={u.id} className="ps-unit">
            <div className="ps-unit-head">
              <h2>{copies.length > 1 && <><span className="ps-n">{copies.length} ×</span>{" "}</>}{`${u.n} ${u.v}`.trim()}</h2>
              <span className="ps-meta">{unitMeta(u, force.faction)}</span>
              <span className="ps-cost">{u.dp} DP · {spText(u.sp)} SP{copies.length > 1 && ` each`}</span>
            </div>
            <table className="ps-table">
              <thead><tr>{STAT_KEYS.map((k) => <th key={k}>{k}</th>)}</tr></thead>
              <tbody><tr>{u.ch.map((c, i) => <td key={i}>{c}</td>)}</tr></tbody>
            </table>
            {u.w.length > 0 && (
              <table className="ps-table ps-weapons">
                <thead>
                  <tr>
                    <th className="ps-left">Weapon</th>
                    <th colSpan={2}>{t.ccHead}</th>
                    <th colSpan={3}>{t.shortHead}</th>
                    <th colSpan={3}>{t.longHead}</th>
                    <th>CF</th>
                  </tr>
                </thead>
                <tbody>
                  {u.w.map((w, wi) => {
                    const cells = (b: string[] | null, from: number, to: number) =>
                      Array.from({ length: to - from }, (_, i) => <td key={from + i}>{b ? b[from + i] || "—" : "—"}</td>);
                    return (
                      <tr key={wi}>
                        <td className="ps-left">{w.n}{w.tr.length > 0 && <span className="ps-traits"> ({w.tr.join(", ")})</span>}</td>
                        {cells(w.cc, 1, 3)}
                        {cells(w.s, 0, 3)}
                        {cells(w.l, 0, 3)}
                        <td>{w.cf}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {/* Abilities without rules text yet go on one line; the rest get their text. */}
            {u.a.some((_, i) => !abilityText(u.ak[i])) && (
              <div className="ps-abilities">{u.a.filter((_, i) => !abilityText(u.ak[i])).join(" · ")}</div>
            )}
            <dl className="ps-rules">
              {u.a.map((label, i) => {
                const txt = abilityText(u.ak[i], "en", u.ap[i]);
                return txt ? (
                  <div key={i}>
                    <dt>{label}</dt>
                    <dd>{txt}</dd>
                  </div>
                ) : null;
              })}
              {traits.map((tr, i) => {
                if (!tr.text || seenTrait.has(tr.label)) return null;
                seenTrait.add(tr.label);
                return (
                  <div key={`t${i}`}>
                    <dt>{tr.label}</dt>
                    <dd>{tr.text}</dd>
                  </div>
                );
              })}
            </dl>
            {copies.some((k) => k.length) && (
              <ul className="ps-kit">
                {copies.map((k, ci) =>
                  k.map((aid) => {
                    const a = assetById(aid);
                    return (
                      <li key={`${ci}-${aid}`}>
                        <b>{a?.n ?? aid}</b>{copies.length > 1 && ` (#${ci + 1})`} — {a?.dp ?? 0} DP. {a?.fx}
                      </li>
                    );
                  }),
                )}
              </ul>
            )}
          </section>
        );
      })}

      {force.forceAssets.length > 0 && (
        <section className="ps-unit">
          <div className="ps-unit-head"><h2>{t.forceAssetsHead}</h2></div>
          <ul className="ps-kit">
            {force.forceAssets.map((x) => {
              const a = assetById(x.a);
              return <li key={x.i}><b>{a?.n ?? x.a}</b> — {a?.dp ?? 0} DP. {a?.fx}</li>;
            })}
          </ul>
        </section>
      )}

      {empty && <p>{t.rosterEmptyTitle}.</p>}
      <footer className="ps-foot">Warzone Eternal roster builder · printed {new Date().toLocaleDateString("en-GB")}</footer>
    </>
  );
}
