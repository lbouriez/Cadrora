import { useId } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';

/** Shared labelled select. Example: <Select label={t('form.access')}><option>…</option></Select>. */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
  error?: string;
  hint?: string;
  label: string;
}

export function Select({ children, className = '', error, hint, id: suppliedId, label, ...props }: SelectProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const labelId = `${id}-label`;
  const description = error ?? hint;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <label className="field" htmlFor={id}>
      <span className="field__label" id={labelId}>{label}</span>
      <select
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        aria-labelledby={labelId}
        className={`field__input ${className}`.trim()}
        id={id}
        {...props}
      >
        {children}
      </select>
      {description ? (
        <span className="field__hint" id={descriptionId} role={error ? 'alert' : undefined}>
          {description}
        </span>
      ) : null}
    </label>
  );
}
