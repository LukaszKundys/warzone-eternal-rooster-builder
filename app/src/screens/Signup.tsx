import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Alert, PasswordField, StrengthMeter, TextField } from "../components/Fields";
import { GoogleButton } from "./GoogleButton";
import { useAuth } from "../lib/auth";
import { useAuthForm } from "../lib/useAuthForm";
import { isEmail } from "../lib/validation";

export function Signup() {
  const { backend } = useAuth();
  const navigate = useNavigate();
  const form = useAuthForm({ name: "", email: "", pw: "", terms: false });
  const { f, set, errs } = form;

  const onSubmit = () =>
    form.submit(
      (v) => ({
        name: v.name.trim().length >= 2 ? "" : "Display name must be at least 2 characters.",
        email: isEmail(v.email) ? "" : "Enter a valid email address.",
        pw: v.pw.length >= 8 ? "" : "Use at least 8 characters.",
        terms: v.terms ? "" : "You must accept to continue.",
      }),
      async (v) => {
        const res = await backend.signUp(v.name, v.email, v.pw);
        if (res.needsConfirmation) form.setNotice(`Check your inbox. We sent a confirmation link to ${v.email.trim()}.`);
        else navigate("/lists", { replace: true });
      },
    );

  return (
    <AuthLayout
      title="Create account"
      subtitle="Save your forces and pick them up on any device."
      onSubmit={onSubmit}
      footer={<>Already have an account? <Link to="/login">Log in</Link></>}
    >
      <TextField label="Display name" value={f.name} onChange={set("name")} error={errs.name} placeholder="Commander name" autoComplete="nickname" />
      <TextField label="Email" type="email" value={f.email} onChange={set("email")} error={errs.email} placeholder="you@example.com" autoComplete="email" />
      <PasswordField value={f.pw} onChange={set("pw")} error={errs.pw} placeholder="At least 8 characters" autoComplete="new-password" />
      <StrengthMeter password={f.pw} />
      <label className="check top">
        <input type="checkbox" checked={f.terms} onChange={(e) => set("terms")(e.target.checked)} aria-invalid={!!errs.terms} />
        <span>
          I agree to the <a href="#">Terms of Use</a> and <a href="#">Privacy Policy</a>.
          <span className="field-error" role={errs.terms ? "alert" : undefined}>{errs.terms}</span>
        </span>
      </label>
      <Alert kind="error">{form.formError}</Alert>
      <Alert kind="notice">{form.notice}</Alert>
      <button type="submit" className="btn-primary lg" disabled={form.busy}>Create account</button>
      <GoogleButton onError={form.setFormError} />
    </AuthLayout>
  );
}
