import { useId } from 'react';
import type { InputHTMLAttributes, Ref } from 'react';

/** Shared labelled input. Example: <Input label={t('form.title')} name="title" />. */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
}

export function Input({ error, hint, id: suppliedId, inputRef, label, ...props }: InputProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const labelId = `${id}-label`;
  const description = error ?? hint;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <label className="field" htmlFor={id}>
      <span className="field__label" id={labelId}>{label}</span>
      <input
        aria-describedby={descriptionId}
        aria-invalid={error ? true : undefined}
        aria-labelledby={labelId}
        className="field__input"
        id={id}
        ref={inputRef}
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
