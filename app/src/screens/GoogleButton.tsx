import { useAuth } from "../lib/auth";
import { authErrors } from "../lib/strings";
import { AuthError } from "../lib/types";

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
      <button type="button" className="btn-google" onClick={go}>Continue with Google</button>
    </>
  );
}
