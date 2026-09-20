import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ToastContext } from './toastContext';
import type { ToastMessage } from './toastContext';

/** Toast host and context. Example: wrap the app in <ToastProvider />, then call useToast().show(). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const dismiss = useCallback((id: string) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);
  const show = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setMessages((current) => [...current, { id, message }]);
    return id;
  }, []);
  const value = useMemo(() => ({ dismiss, show }), [dismiss, show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-relevant="additions removals" className="toast-region">
        {messages.map((toast) => (
          <div className="toast" key={toast.id} role="status">
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
