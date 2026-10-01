import { useId, useState, type ReactNode } from "react";
import { passwordScore, strengthColors, strengthHint, strengthLabels } from "../lib/validation";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}

export function TextField({ label, value, onChange, error = "", type = "text", placeholder, autoComplete }: TextFieldProps) {
  const errId = useId();
  return (
    <label className="field">
      {label}
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={errId}
      />
      <span className="field-error" id={errId} role={error ? "alert" : undefined}>{error}</span>
    </label>
  );
}

interface PasswordFieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  /** Rendered at the right of the label row, e.g. "Forgot password?". */
  aside?: ReactNode;
}

export function PasswordField({ label = "Password", value, onChange, error = "", placeholder, autoComplete, aside }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const inputId = useId();
  const errId = useId();
  return (
    <div className="field">
      <span className="field-head">
        <label htmlFor={inputId}>{label}</label>
        {aside}
      </span>
      <span className="pw-wrap">
        <input
          id={inputId}
          className="input"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={errId}
        />
        <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}>
          {show ? "Hide" : "Show"}
        </button>
      </span>
      <span className="field-error" id={errId} role={error ? "alert" : undefined}>{error}</span>
    </div>
  );
}

export function StrengthMeter({ password }: { password: string }) {
  const score = password ? passwordScore(password) : 0;
  return (
    <div className="strength">
      <div className="strength-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ background: score >= i ? strengthColors[score] : strengthColors[0] }} />
        ))}
      </div>
      <div className="strength-label" aria-live="polite">{password ? strengthLabels[score] : strengthHint}</div>
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "notice"; children: ReactNode }) {
  return children ? <div className={`alert ${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div> : null;
}
