import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { To } from 'react-router-dom';

/** Shared themed return navigation. Example: <BackLink to="/">Back to home</BackLink>. */
export interface BackLinkProps {
  children: ReactNode;
  className?: string;
  to: To;
}

export function BackLink({ children, className = '', to }: BackLinkProps) {
  return (
    <Link className={`back-link ${className}`.trim()} to={to}>
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
