/** Shared determinate progress. Example: <ProgressBar label={t('import.progress')} max={10} value={4} />. */
export interface ProgressBarProps {
  label: string;
  max: number;
  value: number;
  valueText?: string;
}

export function ProgressBar({ label, max, value, valueText }: ProgressBarProps) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.min(safeMax, Math.max(0, value));
  const percentage = (safeValue / safeMax) * 100;

  return (
    <div
      aria-label={label}
      aria-valuemax={safeMax}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      aria-valuetext={valueText}
      className="progress-bar"
      role="progressbar"
    >
      <div className="progress-bar__value" style={{ width: `${percentage}%` }} />
    </div>
  );
}
