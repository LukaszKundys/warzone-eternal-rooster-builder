import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = useCallback((t: string) => {
    setText(t);
    clearTimeout(timer.current);
    // Long messages (import errors) stay up long enough to read.
    timer.current = setTimeout(() => setText(""), Math.max(2200, t.length * 60));
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider value={flash}>
      {children}
      <div aria-live="polite">{text && <div className="toast">{text}</div>}</div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
