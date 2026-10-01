import { Link } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Alert, TextField } from "../components/Fields";
import { useAuth } from "../lib/auth";
import { useAuthForm } from "../lib/useAuthForm";
import { isEmail } from "../lib/validation";

export function ForgotPassword() {
  const { backend } = useAuth();
  const form = useAuthForm({ email: "" });
  const { f, set, errs } = form;

  const onSubmit = () =>
    form.submit(
      (v) => ({ email: isEmail(v.email) ? "" : "Enter a valid email address." }),
      async (v) => {
        await backend.requestPasswordReset(v.email);
        form.setNotice(`If an account exists for ${v.email.trim()}, a reset link is on its way.`);
      },
    );

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Enter your email and we will send a reset link."
      onSubmit={onSubmit}
      footer={<>Remembered it? <Link to="/login">Back to log in</Link></>}
    >
      <TextField label="Email" type="email" value={f.email} onChange={set("email")} error={errs.email} placeholder="you@example.com" autoComplete="email" />
      <Alert kind="error">{form.formError}</Alert>
      <Alert kind="notice">{form.notice}</Alert>
      <button type="submit" className="btn-primary lg" disabled={form.busy}>Send reset link</button>
    </AuthLayout>
  );
}
