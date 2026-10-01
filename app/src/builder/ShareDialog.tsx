import { useEffect, useState } from "react";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";

export const shareUrl = (shareId: string) => new URL(`shared/${shareId}`, window.location.origin + import.meta.env.BASE_URL).toString();

/** Turn a list's share link on or off, and copy it. */
export function ShareDialog({
  userId,
  listId,
  shareId,
  onChange,
  onClose,
}: {
  userId: string;
  listId: string;
  shareId: string | null;
  onChange: (shareId: string | null) => void;
  onClose: () => void;
}) {
  const { backend } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      onChange(await backend.setSharing(userId, listId, on));
    } catch {
      toast("Couldn't change sharing. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch {
      toast("Couldn't copy. Select the link and copy it.");
    }
  };

  const url = shareId && shareUrl(shareId);
  return (
    <div className="sheet-backdrop modal" onClick={onClose}>
      <div className="sheet share-dialog" role="dialog" aria-modal="true" aria-label="Share list" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="sheet-bar" />
          <div className="sheet-title"><h2>Share list</h2></div>
          <button className="icon-btn lg" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="sheet-body">
          {url ? (
            <>
              <p className="share-text">Anyone with this link can view the list. They can't change it, but signed-in players can save a copy to their own lists.</p>
              <div className="share-link">
                <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
                <button className="btn-gold small" onClick={() => copy(url)}>Copy link</button>
              </div>
              <p className="share-text dim">Saved changes show up on the link. Turning sharing off breaks the link; turning it on again makes a new one.</p>
              <button className="btn-dashed" disabled={busy} onClick={() => toggle(false)}>Stop sharing</button>
            </>
          ) : (
            <>
              <p className="share-text">Create a link anyone can open to view this list, without an account. Only you can edit it.</p>
              <button className="btn-gold" disabled={busy} onClick={() => toggle(true)}>Create link</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
