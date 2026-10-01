import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import type { SavedList, User } from "../lib/types";
import { AccountMenu } from "./AccountMenu";
import { ListCard } from "./ListCard";

const FILTERS = ["All", "Loyalist", "Rebel", "Over limit"] as const;
type Filter = (typeof FILTERS)[number];

export function MyLists({ user }: { user: User }) {
  const { backend } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [lists, setLists] = useState<SavedList[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    backend.listLists(user.id).then(
      (l) => live && setLists(l),
      () => {
        if (!live) return;
        setLists([]);
        toast("Couldn't load your lists. Check your connection.");
      },
    );
    return () => {
      live = false;
    };
  }, [backend, user.id, toast]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lists ?? []).filter(
      (l) =>
        (!q || (l.name + " " + l.faction).toLowerCase().includes(q)) &&
        (filter === "All" || (filter === "Over limit" ? l.points > l.limit : l.allegiance === filter)),
    );
  }, [lists, query, filter]);

  // The builder isn't part of this app yet; these become navigations once it is.
  const openBuilder = (l?: SavedList) => toast(l ? `“${l.name}” will open in the builder once it's connected.` : "New lists will open in the builder once it's connected.");

  const duplicate = async (l: SavedList) => {
    try {
      const { id: _id, updatedAt: _u, ...draft } = l;
      const copy = await backend.createList(user.id, { ...draft, name: `${l.name} (copy)` });
      setLists((cur) => {
        const arr = (cur ?? []).slice();
        arr.splice(arr.findIndex((x) => x.id === l.id) + 1, 0, copy);
        return arr;
      });
      toast("List duplicated");
    } catch {
      toast("Couldn't duplicate the list. Check your connection.");
    }
  };

  const remove = async (l: SavedList) => {
    try {
      await backend.deleteList(user.id, l.id);
      setLists((cur) => (cur ?? []).filter((x) => x.id !== l.id));
      setConfirmId(null);
      toast("List deleted");
    } catch {
      toast("Couldn't delete the list. Check your connection.");
    }
  };

  const logout = async () => {
    await backend.signOut();
    navigate("/login", { replace: true });
  };

  const n = lists?.length ?? 0;
  const newListButton = <button className="btn-primary md" onClick={() => openBuilder()}>+ New list</button>;

  return (
    <>
      <header className="topbar">
        <div className="topbar-bar" />
        <div className="topbar-title">Warzone Eternal</div>
        <div className="spacer" />
        <AccountMenu user={user} onSettings={() => toast("Account settings aren't available yet.")} onLogout={logout} />
      </header>

      <main className="lists">
        <div className="lists-head">
          <div className="lists-head-text">
            <h1 className="lists-title">My lists</h1>
            <div className="lists-count">{lists === null ? "Loading…" : n ? `${n} ${n === 1 ? "saved list" : "saved lists"}` : "Nothing saved yet"}</div>
          </div>
          {newListButton}
        </div>

        {n > 0 && (
          <div className="toolbar">
            <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lists" aria-label="Search lists" />
            <div className="filters" role="group" aria-label="Filter lists">
              {FILTERS.map((label) => (
                <button key={label} className="chip" aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>
              ))}
            </div>
          </div>
        )}

        {visible.length > 0 && (
          <div className="grid">
            {visible.map((l) => (
              <ListCard
                key={l.id}
                list={l}
                confirming={confirmId === l.id}
                onEdit={() => openBuilder(l)}
                onDuplicate={() => duplicate(l)}
                onAskDelete={() => setConfirmId(l.id)}
                onCancelDelete={() => setConfirmId(null)}
                onDelete={() => remove(l)}
              />
            ))}
          </div>
        )}

        {n > 0 && visible.length === 0 && <div className="no-match">No lists match your search.</div>}

        {lists !== null && n === 0 && (
          <div className="empty">
            <div className="brand-bar" />
            <h2 className="empty-title">No lists yet</h2>
            <p className="empty-text">Build your first force. Pick a faction, allegiance and game size, then add units.</p>
            {newListButton}
          </div>
        )}
      </main>
    </>
  );
}
