import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Alert, PasswordField, StrengthMeter } from "../components/Fields";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { useAuthForm } from "../lib/useAuthForm";

/** Target of the emailed reset link. Not in the design; built from the same parts as Sign up. */
export function ResetPassword() {
  const { backend } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const form = useAuthForm({ pw: "" });
  const { f, set, errs } = form;

  const onSubmit = () =>
    form.submit(
      (v) => ({ pw: v.pw.length >= 8 ? "" : "Use at least 8 characters." }),
      async (v) => {
        await backend.updatePassword(v.pw);
        toast("Password updated");
        navigate("/lists", { replace: true });
      },
    );

  return (
    <AuthLayout
      title="Set new password"
      subtitle="Choose a new password for your account."
      onSubmit={onSubmit}
      footer={<>Remembered it? <Link to="/login">Back to log in</Link></>}
    >
      <PasswordField label="New password" value={f.pw} onChange={set("pw")} error={errs.pw} placeholder="At least 8 characters" autoComplete="new-password" />
      <StrengthMeter password={f.pw} />
      <Alert kind="error">{form.formError}</Alert>
      <button type="submit" className="btn-primary lg" disabled={form.busy}>Save password</button>
    </AuthLayout>
  );
}
