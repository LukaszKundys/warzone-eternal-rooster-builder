import { Link, useLocation, useNavigate } from "react-router-dom";
import { useReturnTo } from "../lib/useReturnTo";
import { AuthLayout } from "../components/AuthLayout";
import { Alert, PasswordField, TextField } from "../components/Fields";
import { GoogleButton } from "./GoogleButton";
import { useAuth } from "../lib/auth";
import { useAuthForm } from "../lib/useAuthForm";
import { isEmail } from "../lib/validation";

export function Login() {
  const { backend } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = useReturnTo();
  const form = useAuthForm({ email: "", pw: "", remember: true });
  const { f, set, errs } = form;

  const onSubmit = () =>
    form.submit(
      (v) => ({
        email: isEmail(v.email) ? "" : "Enter a valid email address.",
        pw: v.pw ? "" : "Enter your password.",
      }),
      async (v) => {
        await backend.signIn(v.email, v.pw, v.remember);
        navigate(returnTo, { replace: true });
      },
    );

  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back. Sign in to open your saved lists."
      onSubmit={onSubmit}
      footer={<>New here? <Link to="/signup" state={location.state}>Create an account</Link></>}
    >
      <TextField label="Email" type="email" value={f.email} onChange={set("email")} error={errs.email} placeholder="you@example.com" autoComplete="email" />
      <PasswordField
        value={f.pw}
        onChange={set("pw")}
        error={errs.pw}
        placeholder="Your password"
        autoComplete="current-password"
        aside={<Link to="/forgot-password">Forgot password?</Link>}
      />
      <label className="check">
        <input type="checkbox" checked={f.remember} onChange={(e) => set("remember")(e.target.checked)} /> Keep me signed in
      </label>
      <Alert kind="error">{form.formError}</Alert>
      <button type="submit" className="btn-primary lg" disabled={form.busy}>Log in</button>
      <GoogleButton onError={form.setFormError} />
    </AuthLayout>
  );
}
