import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, PasswordField, StrengthMeter, TextField } from "../components/Fields";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { authErrors } from "../lib/strings";
import { AuthError, type User } from "../lib/types";
import { useAuthForm } from "../lib/useAuthForm";
import { isEmail } from "../lib/validation";

/** Not in the design: built from the auth screens' fields and cards. */
export function Account({ user }: { user: User }) {
  return (
    <>
      <header className="topbar">
        <Link to="/lists" className="topbar-back">← <span>My lists</span></Link>
        <div className="topbar-title">Account</div>
      </header>
      <main className="settings">
        <NameSection user={user} />
        <EmailSection user={user} />
        <PasswordSection />
        <DeleteSection />
      </main>
    </>
  );
}

function Section({ title, text, danger, onSubmit, children }: { title: string; text?: string; danger?: boolean; onSubmit: () => void; children: ReactNode }) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form className={danger ? "settings-card danger" : "settings-card"} onSubmit={submit} noValidate aria-label={title}>
      <h2 className="settings-title">{title}</h2>
      {text && <p className="settings-text">{text}</p>}
      {children}
    </form>
  );
}

/** A wrong current password belongs under that field, not in the form-level alert. */
const isWrongPassword = (err: unknown) => err instanceof AuthError && err.code === "wrong_password";

function NameSection({ user }: { user: User }) {
  const { backend } = useAuth();
  const toast = useToast();
  const form = useAuthForm({ name: user.name });
  const { f, set, errs } = form;
  const onSubmit = () =>
    form.submit(
      (v) => ({ name: v.name.trim().length >= 2 ? "" : "Display name must be at least 2 characters." }),
      async (v) => {
        await backend.updateName(v.name);
        toast("Display name saved");
      },
    );
  return (
    <Section title="Display name" text="Shown in the account menu." onSubmit={onSubmit}>
      <TextField label="Display name" value={f.name} onChange={set("name")} error={errs.name} autoComplete="nickname" />
      <Alert kind="error">{form.formError}</Alert>
      <button type="submit" className="btn-secondary" disabled={form.busy || f.name.trim() === user.name}>Save name</button>
    </Section>
  );
}

function EmailSection({ user }: { user: User }) {
  const { backend } = useAuth();
  const toast = useToast();
  const form = useAuthForm({ email: "" });
  const { f, set, errs } = form;
  const onSubmit = () =>
    form.submit(
      (v) => ({
        email: !isEmail(v.email)
          ? "Enter a valid email address."
          : v.email.trim().toLowerCase() === user.email.toLowerCase()
            ? "That's already your email address."
            : "",
      }),
      async (v) => {
        const { needsConfirmation } = await backend.changeEmail(v.email);
        set("email")("");
        if (needsConfirmation) {
          form.setNotice(`We sent a confirmation link to ${v.email.trim()}. Your email changes once you open it in this browser.`);
        } else toast("Email updated");
      },
    );
  return (
    <Section title="Email" text={`Currently ${user.email}. You log in with this address.`} onSubmit={onSubmit}>
      <TextField label="New email" type="email" value={f.email} onChange={set("email")} error={errs.email} placeholder="you@example.com" autoComplete="email" />
      <Alert kind="error">{form.formError}</Alert>
      <Alert kind="notice">{form.notice}</Alert>
      <button type="submit" className="btn-secondary" disabled={form.busy}>Change email</button>
    </Section>
  );
}

function PasswordSection() {
  const { backend } = useAuth();
  const toast = useToast();
  const form = useAuthForm({ current: "", pw: "" });
  const { f, set, errs } = form;
  const [wrong, setWrong] = useState(false);
  const onSubmit = () =>
    form.submit(
      (v) => ({
        current: v.current ? "" : "Enter your current password.",
        pw: v.pw.length >= 8 ? "" : "Use at least 8 characters.",
      }),
      async (v) => {
        setWrong(false);
        try {
          await backend.changePassword(v.current, v.pw);
        } catch (err) {
          if (!isWrongPassword(err)) throw err;
          setWrong(true);
          return;
        }
        set("current")("");
        set("pw")("");
        toast("Password updated");
      },
    );
  return (
    <Section title="Password" onSubmit={onSubmit}>
      <PasswordField
        label="Current password"
        value={f.current}
        onChange={(v) => { setWrong(false); set("current")(v); }}
        error={errs.current || (wrong ? authErrors.wrong_password : "")}
        placeholder="Your current password"
        autoComplete="current-password"
      />
      <PasswordField label="New password" value={f.pw} onChange={set("pw")} error={errs.pw} placeholder="At least 8 characters" autoComplete="new-password" />
      <StrengthMeter password={f.pw} />
      <Alert kind="error">{form.formError}</Alert>
      <button type="submit" className="btn-secondary" disabled={form.busy}>Change password</button>
    </Section>
  );
}

function DeleteSection() {
  const { backend } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useAuthForm({ pw: "" });
  const { f, set, errs } = form;
  const [confirming, setConfirming] = useState(false);
  const [wrong, setWrong] = useState(false);

  const onSubmit = () =>
    form.submit(
      (v) => ({ pw: v.pw ? "" : "Enter your password to confirm." }),
      async (v) => {
        // First press asks; the second one deletes.
        if (!confirming) return setConfirming(true);
        try {
          await backend.deleteAccount(v.pw);
        } catch (err) {
          setConfirming(false);
          if (!isWrongPassword(err)) throw err;
          setWrong(true);
          return;
        }
        toast("Account deleted");
        navigate("/login", { replace: true });
      },
    );

  return (
    <Section
      title="Delete account"
      text="Deletes your account and every list saved in it. This can't be undone."
      danger
      onSubmit={onSubmit}
    >
      <PasswordField
        value={f.pw}
        onChange={(v) => { setWrong(false); setConfirming(false); set("pw")(v); }}
        error={errs.pw || (wrong ? authErrors.wrong_password : "")}
        placeholder="Your password"
        autoComplete="current-password"
      />
      <Alert kind="error">{form.formError}</Alert>
      {confirming ? (
        <div className="confirm">
          <span>Delete your account and all your lists permanently?</span>
          <button type="button" className="cancel" onClick={() => setConfirming(false)} autoFocus>Cancel</button>
          <button type="submit" className="yes" disabled={form.busy}>Delete</button>
        </div>
      ) : (
        <button type="submit" className="btn-danger" disabled={form.busy}>Delete account</button>
      )}
    </Section>
  );
}
