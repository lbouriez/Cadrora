import { useId } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

/** Shared file drop target. Example: <Dropzone label={t('import.dropzoneLabel')} onFiles={addFiles} />. */
export interface DropzoneProps {
  accept?: string;
  description: string;
  disabled?: boolean;
  label: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}

export function Dropzone({
  accept,
  description,
  disabled = false,
  label,
  multiple = true,
  onFiles,
}: DropzoneProps) {
  const id = useId();
  const receive = (files: FileList | null) => {
    if (files) onFiles([...files]);
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => receive(event.currentTarget.files);
  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!disabled) receive(event.dataTransfer.files);
  };

  return (
    <label
      className={`dropzone ${disabled ? 'dropzone--disabled' : ''}`.trim()}
      htmlFor={id}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <span className="dropzone__label">{label}</span>
      <span className="dropzone__description">{description}</span>
      <input
        accept={accept}
        className="dropzone__input"
        disabled={disabled}
        id={id}
        multiple={multiple}
        onChange={onChange}
        type="file"
      />
    </label>
  );
}
