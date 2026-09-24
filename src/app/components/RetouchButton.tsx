import { IconButton } from './IconButton';
import { RetouchIcon } from './Icons';

/** Distinct from a shared heart: this marks a photo for the photographer's retouching queue. */
export function RetouchButton({ className = '', disabled = false, label, onToggle, selected }: {
  className?: string;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
  selected: boolean;
}) {
  return <IconButton aria-label={label} aria-pressed={selected}
    className={`retouch-button${selected ? ' retouch-button--selected' : ''} ${className}`.trim()}
    disabled={disabled} onClick={onToggle} title={label}><RetouchIcon /></IconButton>;
}
