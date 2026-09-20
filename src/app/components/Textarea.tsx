import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

/** Shared labelled multiline input. Example: <Textarea label={t('form.description')} name="description" />. */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  hint?: string;
  label: string;
}

export function Textarea({ className = '', error, hint, id: suppliedId, label, ...props }: TextareaProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const labelId = `${id}-label`;
  const description = error ?? hint;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <label className="field" htmlFor={id}>
      <span className="field__label" id={labelId}>{label}</span>
      <textarea
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        aria-labelledby={labelId}
        className={`field__input field__textarea ${className}`.trim()}
        id={id}
        {...props}
      />
      {description ? (
        <span className="field__hint" id={descriptionId} role={error ? 'alert' : undefined}>
          {description}
        </span>
      ) : null}
    </label>
  );
}
