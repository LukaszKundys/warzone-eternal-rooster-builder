import type { AuthErrorCode } from "./types";

// English copy. Kept in one place so a Polish locale can be added alongside it.
export const authErrors: Record<AuthErrorCode, string> = {
  invalid_credentials: "Email or password is incorrect.",
  wrong_password: "That password is incorrect.",
  same_password: "Choose a password different from your current one.",
  email_taken: "An account with this email already exists. Try logging in instead.",
  email_not_confirmed: "Confirm your email address first. Check your inbox for the link.",
  weak_password: "That password is too weak. Use at least 8 characters.",
  link_expired: "This reset link is invalid or has expired. Request a new one.",
  provider_unavailable: "Google sign-in isn't available yet.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  network: "Can't reach the server. Check your connection and try again.",
  unknown: "Something went wrong. Please try again.",
};
