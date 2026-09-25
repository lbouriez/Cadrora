import { useId, useState } from 'react';

import { InfoIcon } from './Icons';

/** Short, contextual help. Example: <InfoTooltip text={t('gallery.visibilityHint')} />. */
export interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="info-tooltip"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        aria-label={text}
        className="info-tooltip__trigger"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        type="button"
      >
        <InfoIcon />
      </button>
      {open ? <span className="info-tooltip__content" id={id} role="tooltip">{text}</span> : null}
    </span>
  );
}
