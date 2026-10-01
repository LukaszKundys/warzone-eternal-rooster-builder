import { useState } from "react";
import { authErrors } from "./strings";
import { AuthError } from "./types";

type Errors<T> = Partial<Record<keyof T, string>>;
type Widen<T> = { [K in keyof T]: T[K] extends boolean ? boolean : string };

/** Field values, per-field errors, a form-level error/notice and a busy flag for one auth form. */
export function useAuthForm<I extends Record<string, string | boolean>>(initial: I) {
  type T = Widen<I>;
  const [f, setF] = useState<T>(initial as T);
  const [errs, setErrs] = useState<Errors<T>>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Editing a field clears its own error and the form-level error, as in the design.
  const set = <K extends keyof T>(k: K) => (v: T[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setErrs((e) => ({ ...e, [k]: "" }));
    setFormError("");
  };

  /** Validate, then run the async action with busy/error handling. */
  const submit = async (validate: (f: T) => Errors<T>, action: (f: T) => Promise<void>) => {
    if (busy) return;
    const found = validate(f);
    const hasErrors = Object.values(found).some(Boolean);
    setErrs(found);
    setNotice("");
    setFormError("");
    if (hasErrors) return;
    setBusy(true);
    try {
      await action(f);
    } catch (err) {
      setFormError(authErrors[err instanceof AuthError ? err.code : "unknown"]);
    } finally {
      setBusy(false);
    }
  };

  return { f, set, errs, formError, setFormError, notice, setNotice, busy, submit };
}
