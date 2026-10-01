import { useLocation } from "react-router-dom";

/** Where to go after logging in: back to the page that sent the player here (state.from), or My Lists. */
export const useReturnTo = () => (useLocation().state as { from?: string } | null)?.from ?? "/lists";
