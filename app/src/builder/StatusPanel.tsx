import { useBuilder } from "./context";
import { t } from "./copy";
import { download, toJson, toText } from "./exportList";
import { printForce } from "./PrintSheet";

const pct = (n: number, of: number) => `${of ? Math.min(100, Math.round((n / of) * 100)) : 0}%`;

/** Legality, DP and SP meters, the rulebook issues, composition and export. */
export function StatusPanel({ name, wide }: { name: string; wide: boolean }) {
  const { force, qty, kit, inForce, v } = useBuilder();
  const size = force.gameSize;
  const empty = v.unitCount === 0;
  const legal = !empty && v.issues.length === 0;
  const state = legal ? "is-legal" : empty ? "is-empty" : "is-illegal";

  const composition = [
    { label: t.comp.units, value: String(v.unitCount) },
    { label: t.comp.types, value: String(new Set(inForce.map((u) => u.ty)).size) },
    { label: t.comp.leaders, value: String(v.leaders), tone: v.leaders ? "ok" : "bad" },
    { label: t.comp.support, value: String(inForce.filter((u) => u.dg === "support").reduce((n, u) => n + qty[u.id], 0)) },
    { label: t.comp.allies, value: `${v.allyDp} / ${v.allyLimit}`, tone: v.allyDp > v.allyLimit ? "bad" : undefined },
    { label: t.comp.assets, value: String(Object.values(kit).reduce((n, k) => n + k, 0)) },
  ];

  return (
    <div className="scroll status">
      {wide && <div className="col-title"><h2>{t.nav.status}</h2></div>}
      <div className={`legal-box ${state}`} role="status">
        <div className="legal-title"><span className="dot" />{legal ? t.legal : t.illegal}</div>
        <div className="legal-summary">{empty ? t.legalEmpty : legal ? t.legalOk : t.legalBad(v.issues.length)}</div>
      </div>

      <div className="meters">
        <div className="meter">
          <div className="meter-head">
            <span>{t.deployment}</span>
            <span className="meter-n"><span className={v.dp > size ? "bad" : "gold"}>{v.dp}</span><span className="dim">/{size}</span></span>
          </div>
          <div className="bar"><div className={v.dp > size ? "bad" : "gold"} style={{ width: pct(v.dp, size) }} /></div>
          <div className="meter-note">{t.dpNote(size - v.dp, size)}</div>
        </div>
        <div className="meter">
          <div className="meter-head">
            <span>{t.support}</span>
            <span className={`meter-n ${v.spSpent > v.spAvail ? "bad" : "ok"}`}>{v.spSpent} / {v.spAvail}</span>
          </div>
          <div className="bar"><div className={v.spSpent > v.spAvail ? "bad" : "ok"} style={{ width: pct(v.spSpent, v.spAvail) }} /></div>
          <div className="meter-note">{t.spNote(v.spSpent, v.spAvail)}</div>
        </div>
      </div>

      <h3 className="status-k">{t.issues} <span>{empty ? "—" : v.issues.length}</span></h3>
      <div className="issues">
        {v.issues.map((i, n) => (
          <div key={n} className={`issue ${i.sev}`}>
            <div className="issue-line">
              <span className="mark">{i.sev === "error" ? "✕" : "!"}</span>
              <div>{i.text}</div>
            </div>
            <div className="issue-code">{i.code}</div>
          </div>
        ))}
        {legal && <div className="note-box ok">{t.noIssues}</div>}
        {empty && <div className="note-box">{t.nothingToCheck}</div>}
      </div>

      <h3 className="status-k">{t.composition}</h3>
      <div className="composition">
        {composition.map((c) => (
          <div key={c.label} className="comp-row">
            <span>{c.label}</span>
            <span className={c.tone ?? ""}>{c.value}</span>
          </div>
        ))}
      </div>

      <h3 className="status-k">{t.export}</h3>
      <div className="exports">
        <button className="export-btn" onClick={() => printForce(name, force)}>
          <span className="mark">PDF</span><span>{t.exportPdf}</span>
        </button>
        <button className="export-btn" onClick={() => download(name, "txt", toText(name, force))}>
          <span className="mark">TXT</span><span>{t.exportTxt}</span>
        </button>
        <button className="export-btn" onClick={() => download(name, "json", toJson(name, force))}>
          <span className="mark">JSON</span><span>{t.exportJson}</span>
        </button>
      </div>
    </div>
  );
}
