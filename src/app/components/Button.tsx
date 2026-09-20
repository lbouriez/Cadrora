import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Shared action button. Example: <Button variant="primary">Save</Button>.
 * Keep labels translated at the call site and use `type="button"` unless submitting.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ children, className = '', type = 'button', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}

