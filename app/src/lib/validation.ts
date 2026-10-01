export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** 0–4: length ≥ 8, mixed case, a digit, a symbol (or length ≥ 14). */
export function passwordScore(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
  return s;
}

export const strengthColors = ["#262A31", "#D9503F", "#F2A93B", "#C9D13A", "#5BC27A"];
export const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
export const strengthHint = "Use 8+ characters with mixed case, a number and a symbol.";
