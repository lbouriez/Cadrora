import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Compact icon-only action. Example: <IconButton aria-label={t('close')}>×</IconButton>. */
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  'aria-label': string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function IconButton({ children, className = '', type = 'button', variant = 'secondary', ...props }: IconButtonProps) {
  return (
    <button
      className={`icon-button icon-button--${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
