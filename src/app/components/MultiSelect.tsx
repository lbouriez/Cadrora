import { useId } from 'react';

export interface MultiSelectOption<T extends string> {
  label: string;
  value: T;
}

export interface MultiSelectProps<T extends string> {
  hint?: string;
  label: string;
  minSelections?: number;
  onChange: (values: T[]) => void;
  options: MultiSelectOption<T>[];
  values: T[];
}

/** Accessible compact multi-select menu with explicit checkbox choices. */
export function MultiSelect<T extends string>({
  hint,
  label,
  minSelections = 1,
  onChange,
  options,
  values,
}: MultiSelectProps<T>) {
  const id = useId();
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const toggle = (value: T) => {
    if (values.includes(value)) {
      if (values.length <= minSelections) return;
      onChange(values.filter((candidate) => candidate !== value));
    } else {
      onChange([...values, value]);
    }
  };
  return (
    <div className="field multi-select">
      <span className="field__label" id={`${id}-label`}>{label}</span>
      <details aria-labelledby={`${id}-label`} className="multi-select__details">
        <summary className="field__input multi-select__summary">{selectedLabels.join(', ')}</summary>
        <div className="multi-select__menu">
          {options.map((option) => (
            <label className="multi-select__option" key={option.value}>
              <input
                checked={values.includes(option.value)}
                disabled={values.includes(option.value) && values.length <= minSelections}
                onChange={() => toggle(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </details>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
