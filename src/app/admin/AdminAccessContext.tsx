/* eslint-disable react-refresh/only-export-components -- the provider and its typed hook form one auth boundary. */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const AdminAccessContext = createContext({ readOnly: false });

export function AdminAccessProvider({ children, readOnly }: { children: ReactNode; readOnly: boolean }) {
  return <AdminAccessContext.Provider value={{ readOnly }}>{children}</AdminAccessContext.Provider>;
}

export function useAdminAccess() {
  return useContext(AdminAccessContext);
}
