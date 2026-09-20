import { createContext, useContext } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
}

export interface ToastContextValue {
  dismiss: (id: string) => void;
  show: (message: string) => string;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
