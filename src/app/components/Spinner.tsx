/** Shared progress indicator. Example: <Spinner label={t('common.loading')} />. */
export interface SpinnerProps {
  label: string;
}

export function Spinner({ label }: SpinnerProps) {
  return <div aria-label={label} className="spinner" role="status" />;
}

