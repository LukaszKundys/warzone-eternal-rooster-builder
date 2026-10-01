import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Catalogue } from "../builder/Catalogue";
import { BuilderProvider, useBuilder } from "../builder/context";
import { t } from "../builder/copy";
import { emptyForce, forceReducer, fromList, sameForce, toDraft, type Force } from "../builder/force";
import { ForcePanel } from "../builder/ForcePanel";
import { AssetPeek, UnitPeek } from "../builder/Peeks";
import { factionName } from "../builder/rules";
import { SetupFields } from "../builder/SetupFields";
import { StatusPanel } from "../builder/StatusPanel";
import "../builder/builder.css";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { ALLEGIANCE_LABEL, type User } from "../lib/types";

const WIDE = "(min-width: 1100px)";
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia?.(WIDE);
  mq?.addEventListener("change", cb);
  return () => mq?.removeEventListener("change", cb);
};
const isWide = () => window.matchMedia?.(WIDE).matches ?? false;

type Load = "loading" | "ready" | "missing" | "error";

/** Build a new list (/lists/new) or edit a saved one (/lists/:id). */
export function Builder({ user }: { user: User }) {
  // One route for both, so saving a new list can move to its real URL without remounting.
  const { id: param } = useParams();
  const id = param === "new" ? undefined : param;
  const { backend } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const wide = useSyncExternalStore(subscribeWide, isWide);

  const [force, dispatch] = useReducer(forceReducer, undefined, emptyForce);
  const [name, setName] = useState("");
  const [listId, setListId] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ name: string; force: Force } | null>(null);
  const [load, setLoad] = useState<Load>(id ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const [unitPeek, setUnitPeek] = useState<string | null>(null);
  const [assetPeek, setAssetPeek] = useState<string | null>(null);

  useEffect(() => {
    // After the first save the URL moves from /lists/new to /lists/:id; the list is already loaded.
    if (!id || id === listId) return;
    let live = true;
    setLoad("loading");
    backend.getList(user.id, id).then(
      (l) => {
        if (!live) return;
        if (!l) return setLoad("missing");
        const f = fromList(l);
        dispatch({ type: "load", force: f });
        setName(l.name);
        setListId(l.id);
        setSaved({ name: l.name, force: f });
        setLoad("ready");
      },
      () => live && setLoad("error"),
    );
    return () => {
      live = false;
    };
  }, [backend, user.id, id, listId]);

  const finalName = name.trim() || t.untitled;
  const dirty = !saved || !sameForce(saved.force, force) || saved.name !== finalName;
  // A brand-new list with nothing in it isn't worth warning about.
  const unsaved = saved ? dirty : force.units.length + force.forceAssets.length > 0 || name.trim() !== "";

  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const leave = (e: React.MouseEvent) => {
    if (unsaved && !window.confirm(t.leaveUnsaved)) e.preventDefault();
  };

  const save = async () => {
    setSaving(true);
    try {
      const draft = toDraft(finalName, force);
      const l = listId ? await backend.updateList(user.id, listId, draft) : await backend.createList(user.id, draft);
      setName(l.name);
      setSaved({ name: l.name, force });
      if (!listId) {
        setListId(l.id);
        navigate(`/lists/${l.id}`, { replace: true });
      }
      toast("List saved");
    } catch {
      toast("Couldn't save the list. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const peekUnit = useCallback((pid: string | null) => setUnitPeek(pid), []);
  const peekAsset = useCallback((pid: string | null) => setAssetPeek(pid), []);

  if (load !== "ready") {
    return (
      <main className="builder-message">
        {load === "loading" ? (
          <p>Loading list…</p>
        ) : (
          <>
            <h1>{load === "missing" ? "List not found" : "Couldn't load this list"}</h1>
            <p>{load === "missing" ? "It may have been deleted." : "Check your connection and try again."}</p>
            <Link to="/lists">Back to My lists</Link>
          </>
        )}
      </main>
    );
  }

  const header = (
    <header className="builder-bar">
      <Link to="/lists" className="back" onClick={leave}>← <span>{t.back}</span></Link>
      <input
        className="list-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.untitled}
        aria-label={t.listName}
        maxLength={120}
      />
      {wide && <SetupFields />}
      <div className="spacer" />
      {wide && <ClearForce />}
      <button className="btn-save" onClick={save} disabled={saving || (!!saved && !dirty)}>
        {saving ? t.saving : saved && !dirty ? t.saved : t.save}
      </button>
    </header>
  );

  return (
    <BuilderProvider force={force} dispatch={dispatch} peekUnit={peekUnit} peekAsset={peekAsset}>
      <div className={wide ? "builder wide" : "builder"}>
        {header}
        {wide ? (
          <div className="builder-cols">
            <Catalogue key={force.faction} wide />
            <ForcePanel wide />
            <StatusPanel name={finalName} wide />
          </div>
        ) : (
          <MobileBuilder name={finalName} />
        )}
        {unitPeek && <UnitPeek id={unitPeek} wide={wide} />}
        {assetPeek && <AssetPeek id={assetPeek} wide={wide} />}
      </div>
    </BuilderProvider>
  );
}

function ClearForce() {
  const { force, dispatch } = useBuilder();
  if (force.units.length + force.forceAssets.length === 0) return null;
  return <button className="btn-dashed" onClick={() => dispatch({ type: "clear" })}>{t.resetForce}</button>;
}

type View = "catalogue" | "force" | "status";

/** Phone layout: setup summary on top, one panel at a time, tab bar at the bottom. */
function MobileBuilder({ name }: { name: string }) {
  const { force, v, peekUnit, peekAsset } = useBuilder();
  const [view, setView] = useState<View>("catalogue");
  const [setupOpen, setSetupOpen] = useState(false);
  const size = force.gameSize;
  const empty = v.unitCount === 0;
  const legal = !empty && v.issues.length === 0;

  const nav: { key: View; sub: string; bad?: boolean }[] = [
    { key: "catalogue", sub: "" },
    { key: "force", sub: String(v.unitCount) },
    { key: "status", sub: empty ? "—" : v.issues.length ? String(v.issues.length) : "✓", bad: !empty && v.issues.length > 0 },
  ];

  return (
    <>
      <div className="mobile-head">
        <div className="mobile-head-row">
          <button className="setup-toggle" aria-expanded={setupOpen} onClick={() => setSetupOpen((o) => !o)}>
            <span>{factionName(force.faction)} · {size} DP · {ALLEGIANCE_LABEL[force.allegiance]}</span>
            <span className="caret">{setupOpen ? "▲" : "▼"}</span>
          </button>
          <div className={`legal-pill ${legal ? "is-legal" : empty ? "is-empty" : "is-illegal"}`}>
            <span className="dot" />{legal ? t.legal : t.illegal}
          </div>
        </div>
        {setupOpen && (
          <div className="mobile-setup">
            <SetupFields />
            <ClearForce />
          </div>
        )}
        <div className="mobile-meter">
          <div className="bar"><div className={v.dp > size ? "bad" : "gold"} style={{ width: `${Math.min(100, Math.round((v.dp / size) * 100))}%` }} /></div>
          <div className="meter-n"><span className={v.dp > size ? "bad" : "gold"}>{v.dp}</span><span className="dim">/{size} DP</span></div>
          <div className={`meter-n ${v.spSpent > v.spAvail ? "bad" : "ok"}`}>{v.spSpent} / {v.spAvail} SP</div>
        </div>
      </div>

      <div className="mobile-view">
        {view === "catalogue" && <Catalogue key={force.faction} wide={false} />}
        {view === "force" && <ForcePanel wide={false} />}
        {view === "status" && <StatusPanel name={name} wide={false} />}
      </div>

      <nav className="mobile-nav" aria-label="Builder sections">
        {nav.map((n) => (
          <button
            key={n.key}
            aria-current={view === n.key ? "page" : undefined}
            onClick={() => {
              setView(n.key);
              peekUnit(null);
              peekAsset(null);
            }}
          >
            <span className="nav-label">{t.nav[n.key]}</span>
            {n.sub && <span className={n.bad ? "nav-sub bad" : "nav-sub"}>{n.sub}</span>}
          </button>
        ))}
      </nav>
    </>
  );
}
