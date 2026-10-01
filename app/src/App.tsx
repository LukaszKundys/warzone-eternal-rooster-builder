import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { ForgotPassword } from "./screens/ForgotPassword";
import { Login } from "./screens/Login";
import { Account } from "./screens/Account";
import { Builder } from "./screens/Builder";
import { MyLists } from "./screens/MyLists";
import { ResetPassword } from "./screens/ResetPassword";
import { Signup } from "./screens/Signup";

/** Auth screens are for signed-out players; a signed-in player goes straight to their lists. */
function SignedOut({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user ? <Navigate to="/lists" replace /> : children;
}

export function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="page" />;
  return (
    <div className="page">
      <Routes>
        <Route path="/login" element={<SignedOut><Login /></SignedOut>} />
        <Route path="/signup" element={<SignedOut><Signup /></SignedOut>} />
        <Route path="/forgot-password" element={<SignedOut><ForgotPassword /></SignedOut>} />
        {/* The reset link signs the player in, so this route must stay reachable with a session. */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/lists" element={user ? <MyLists user={user} /> : <Navigate to="/login" replace />} />
        <Route path="/account" element={user ? <Account user={user} /> : <Navigate to="/login" replace />} />
        {/* /lists/new builds a new list; any other id edits that list. */}
        <Route path="/lists/:id" element={user ? <Builder user={user} /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={user ? "/lists" : "/login"} replace />} />
      </Routes>
    </div>
  );
}
