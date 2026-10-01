import { useEffect, useRef, useState } from "react";
import type { User } from "../lib/types";

interface Props {
  user: User;
  onSettings: () => void;
  onLogout: () => void;
}

export function AccountMenu({ user, onSettings, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="account" ref={ref}>
      <button className="account-btn" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}>
        <span className="account-name">{user.name}</span>
        <span className="avatar" aria-hidden="true">{(user.name[0] ?? "?").toUpperCase()}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-email">{user.email}</div>
          <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); onSettings(); }}>Account settings</button>
          <button className="menu-item danger" role="menuitem" onClick={onLogout}>Log out</button>
        </div>
      )}
    </div>
  );
}
