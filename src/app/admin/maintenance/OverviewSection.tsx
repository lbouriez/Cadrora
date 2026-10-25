import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, Spinner } from '../../components';
import { getMaintenanceOverview } from './api';

export function OverviewSection() {
  const { i18n, t } = useTranslation();
  const query = useQuery({ queryKey: ['maintenance', 'overview'], queryFn: getMaintenanceOverview, retry: false, refetchOnWindowFocus: false });
  const data = query.data;
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t('admin.maintenance.never');
  const stale = data && (!data.lastSuccessAt || Date.parse(data.observedAt) - Date.parse(data.lastSuccessAt) > 30 * 60_000);
  return <>
    <div className="admin-actions"><h2>{t('admin.maintenance.scheduler')}</h2>
      <Button disabled={query.isFetching} onClick={() => { void query.refetch(); }} variant="secondary">{t('admin.maintenance.refresh')}</Button></div>
    {query.isPending ? <Spinner label={t('admin.maintenance.loading')} /> : null}
    {query.isError ? <p role="alert">{t('admin.maintenance.error')}</p> : null}
    {data ? <>
      <p>{t('admin.maintenance.observed', { time: date(data.observedAt) })}</p>
      <p>{t('admin.maintenance.runNote')}</p>
      {!data.lastRun ? <p role="status">{t('admin.maintenance.unknown')}</p> : <>
        <dl className="maintenance-facts">
          <div><dt>{t('admin.maintenance.lastStart')}</dt><dd>{date(data.lastRun.startedAt)}</dd></div>
          <div><dt>{t('admin.maintenance.status')}</dt><dd>{t(`admin.maintenance.${data.lastRun.state}`)}</dd></div>
          <div><dt>{t('admin.maintenance.lastSuccess')}</dt><dd>{date(data.lastSuccessAt)}</dd></div>
        </dl>
        <p>{t('admin.maintenance.processed', { count: data.lastRun.processed })}</p>
        {stale || data.lastRun.state === 'failed' ? <p role="status">{t('admin.maintenance.stale')}</p> : null}
      </>}
      <h2>{t('admin.maintenance.counts')}</h2>
      <dl className="maintenance-facts">{(['pending', 'running', 'failed', 'completed'] as const).map((state) => <div key={state}>
        <dt>{t(`admin.maintenance.${state}`)}</dt><dd>{data.counts[state]}</dd>
      </div>)}</dl>
      {data.counts.staleRunning > 0 ? <p role="status">{t('admin.maintenance.staleJobs', { count: data.counts.staleRunning })}</p> : null}
      <p>{t('admin.maintenance.retention', { days: data.retentionDays })}</p>
    </> : null}
    <h2>{t('admin.maintenance.recovery')}</h2><p>{t('admin.maintenance.recoveryText')}</p>
    <div className="admin-actions"><Link className="button button--secondary" to="/admin/galleries">{t('admin.maintenance.galleries')}</Link>
      <Link className="button button--secondary" to="/admin/settings">{t('admin.maintenance.settings')}</Link></div>
  </>;
}
