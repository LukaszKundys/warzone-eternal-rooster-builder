import type { FormEvent, ReactNode } from "react";

interface Props {
  title: string;
  subtitle: string;
  onSubmit: () => void;
  footer: ReactNode;
  children: ReactNode;
}

/** Brand block, the form card and the switch link under it. */
export function AuthLayout({ title, subtitle, onSubmit, footer, children }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <main className="auth">
      <div className="auth-col">
        <div className="brand">
          <div className="brand-bar" />
          <div className="brand-title">Warzone Eternal</div>
          <div className="brand-sub">Roster builder</div>
        </div>
        <form className="auth-card" onSubmit={submit} noValidate>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </form>
        <div className="auth-switch">{footer}</div>
      </div>
    </main>
  );
}
