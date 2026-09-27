import { Button } from '../components';

export interface AdminCoverChoice {
  id: string;
  label: string;
  thumbnailUrl: string;
}

export function AdminCoverPhotoPicker({ choices, selectedId, currentThumbnailUrl, onSelect, disabled = false, showEmpty = true, labels }: {
  choices: readonly AdminCoverChoice[];
  selectedId: string | null;
  currentThumbnailUrl?: string | undefined;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
  showEmpty?: boolean;
  labels: {
    choose: (label: string) => string;
    clear: string;
    current: string;
    empty: string;
  };
}) {
  const selected = choices.find((choice) => choice.id === selectedId);
  const preview = selected?.thumbnailUrl ?? (selectedId ? currentThumbnailUrl : undefined);
  return <>
    {preview ? <div className="admin-cover__current">
      <img alt="" src={preview} />
      <span>{labels.current}</span>
    </div> : null}
    {showEmpty && choices.length === 0 ? <p>{labels.empty}</p> : null}
    <div className="admin-cover__grid">
      {choices.map((choice) => <button aria-label={labels.choose(choice.label)} aria-pressed={selectedId === choice.id}
        className="admin-cover__choice" disabled={disabled} key={choice.id} onClick={() => onSelect(choice.id)} type="button">
        <img alt="" loading="lazy" src={choice.thumbnailUrl} />
        <span>{choice.label}</span>
      </button>)}
    </div>
    {selectedId ? <Button disabled={disabled} onClick={() => onSelect(null)} type="button" variant="secondary">{labels.clear}</Button> : null}
  </>;
}
