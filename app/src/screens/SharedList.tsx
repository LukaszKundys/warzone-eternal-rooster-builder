import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BuilderProvider } from "../builder/context";
import { fromList } from "../builder/force";
import { ForcePanel } from "../builder/ForcePanel";
import { StatusPanel } from "../builder/StatusPanel";
import "../builder/builder.css";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { relativeTime } from "../lib/time";
import { ALLEGIANCE_LABEL, type SharedList as Shared } from "../lib/types";

const WIDE = "(min-width: 900px)";
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia?.(WIDE);
  mq?.addEventListener("change", cb);
  return () => mq?.removeEventListener("change", cb);
};
const isWide = () => window.matchMedia?.(WIDE).matches ?? false;
const noop = () => {};

/** Read-only view of a list opened from its share link (/shared/:shareId). Works signed out. */
export function SharedList() {
  const { shareId = "" } = useParams();
  const { backend, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const wide = useSyncExternalStore(subscribeWide, isWide);
  const [list, setList] = useState<Shared | null | "loading" | "error">("loading");
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let live = true;
    backend.getSharedList(shareId).then(
      (l) => live && setList(l),
      () => live && setList("error"),
    );
    return () => {
      live = false;
    };
  }, [backend, shareId]);

  const force = useMemo(() => (list && typeof list === "object" ? fromList(list) : null), [list]);
  const peek = useCallback(noop, []);

  const copy = async () => {
    if (!list || typeof list !== "object") return;
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    setCopying(true);
    try {
      const { updatedAt: _u, ownerName: _o, ...draft } = list;
      const mine = await backend.createList(user.id, { ...draft, name: `${list.name} (copy)` });
      toast("Copied to your lists");
      navigate(`/lists/${mine.id}`);
    } catch {
      toast("Couldn't copy the list. Check your connection.");
      setCopying(false);
    }
  };

  const bar = (
    <header className="builder-bar">
      <div className="topbar-bar" />
      <div className="topbar-title">Warzone Eternal</div>
      <div className="spacer" />
      {user ? <Link to="/lists" className="back">My lists</Link> : <Link to="/login" className="back">Log in</Link>}
    </header>
  );

  if (!force || typeof list !== "object" || !list) {
    return (
      <div className="builder">
        {bar}
        <main className="builder-message">
          {list === "loading" ? (
            <p>Loading list…</p>
          ) : (
            <>
              <h1>{list === "error" ? "Couldn't load this list" : "List not found"}</h1>
              <p>{list === "error" ? "Check your connection and try again." : "The link may be wrong, or its owner stopped sharing it."}</p>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <BuilderProvider force={force} dispatch={noop} peekUnit={peek} peekAsset={peek} readOnly>
      <div className={wide ? "builder wide shared" : "builder shared"}>
        {bar}
        <div className="shared-head">
          <div className="shared-title">
            <h1>{list.name}</h1>
            <div className="meta">
              {list.faction} · {ALLEGIANCE_LABEL[list.allegiance]} · {list.limit} DP ({list.gameSize})
              {list.ownerName && <> · by {list.ownerName}</>} · updated {relativeTime(list.updatedAt)}
            </div>
          </div>
          <button className="btn-save" onClick={copy} disabled={copying}>
            {user ? "Copy to my lists" : "Log in to copy"}
          </button>
        </div>
        {wide ? (
          <div className="builder-cols shared-cols">
            <ForcePanel wide />
            <StatusPanel name={list.name} wide />
          </div>
        ) : (
          <div className="scroll shared-stack">
            <ForcePanel wide={false} />
            <StatusPanel name={list.name} wide={false} />
          </div>
        )}
      </div>
    </BuilderProvider>
  );
}
