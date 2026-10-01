import type { Backend } from "../types";
import { createLocalBackend } from "./local";
import { createSupabaseBackend } from "./supabase";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Supabase when both env vars are set, otherwise the browser-only local backend. */
export const backend: Backend = url && key ? createSupabaseBackend(url, key) : createLocalBackend();
