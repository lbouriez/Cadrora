import { IconButton } from './IconButton';
import { HeartIcon } from './Icons';

/** Shared private-gallery favorite control. Example: <FavoriteButton liked={false} label="Like photo" onToggle={toggle} />. */
export interface FavoriteButtonProps {
  className?: string;
  disabled?: boolean;
  label: string;
  liked: boolean;
  onToggle: () => void;
}

export function FavoriteButton({ className = '', disabled = false, label, liked, onToggle }: FavoriteButtonProps) {
  return (
    <IconButton
      aria-label={label}
      aria-pressed={liked}
      className={`favorite-button${liked ? ' favorite-button--liked' : ''} ${className}`.trim()}
      disabled={disabled}
      onClick={onToggle}
      title={label}
    >
      <HeartIcon />
    </IconButton>
  );
}
