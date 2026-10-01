import { useAuth } from "../lib/auth";
import { authErrors } from "../lib/strings";
import { AuthError } from "../lib/types";

/** Google sign-in is switched off until the provider is set up in Supabase. Flip this to turn it on. */
const GOOGLE_ENABLED = false;

/** The "or" divider and "Continue with Google". Supabase redirects away on success. */
export function GoogleButton({ onError }: { onError: (msg: string) => void }) {
  const { backend } = useAuth();
  const go = async () => {
    onError("");
    try {
      await backend.signInWithGoogle();
    } catch (err) {
      onError(authErrors[err instanceof AuthError ? err.code : "unknown"]);
    }
  };
  return (
    <>
      <div className="or">or</div>
      {GOOGLE_ENABLED ? (
        <button type="button" className="btn-google" onClick={go}>Continue with Google</button>
      ) : (
        <button type="button" className="btn-google" disabled title="Coming soon">
          Continue with Google <span className="btn-note">· coming soon</span>
        </button>
      )}
    </>
  );
}
