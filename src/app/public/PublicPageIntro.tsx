import type { ReactNode } from 'react';

import { MotionReveal } from '../components';

/** Shared heading geometry for the public site's editorial pages. */
export function PublicPageIntro({ children, eyebrow, lead, title }: {
  children?: ReactNode;
  eyebrow: string;
  lead?: string;
  title: string;
}) {
  return <MotionReveal as="header" className="editorial-heading public-page-intro">
    <p className="site-eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    {lead ? <p>{lead}</p> : null}
    {children}
  </MotionReveal>;
}
