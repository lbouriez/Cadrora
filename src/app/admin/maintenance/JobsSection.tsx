import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { z } from '../../../shared/zod';
import { MaintenanceJobQuerySchema, type MaintenanceJobCursorSchema } from '../../../shared/schemas/maintenance';
import { Button, Select, Spinner } from '../../components';
import { getMaintenanceJobs } from './api';

export function JobsSection() {
  const { i18n, t } = useTranslation();
  const [state, setState] = useState<z.infer<typeof MaintenanceJobQuerySchema>['state']>('active');
  const query = useInfiniteQuery({ queryKey: ['maintenance', 'jobs', state], initialPageParam: null as z.infer<typeof MaintenanceJobCursorSchema> | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ state });
      if (pageParam) { params.set('beforeCreatedAt', pageParam.createdAt); params.set('beforeId', pageParam.id); }
      return getMaintenanceJobs(params);
    }, getNextPageParam: (page) => page.nextCursor, retry: false, refetchOnWindowFocus: false });
  const rows = query.data?.pages.flatMap((page) => page.jobs) ?? [];
  const date = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  return <>
    <h2>{t('admin.maintenance.jobs')}</h2><p>{t('admin.maintenance.jobsNote')}</p>
    <div className="maintenance-filters"><Select label={t('admin.maintenance.status')} value={state} onChange={(event) => setState(MaintenanceJobQuerySchema.parse({ state: event.target.value }).state)}>
      {(['active', 'pending', 'running', 'failed', 'completed'] as const).map((value) => <option key={value} value={value}>{t(`admin.maintenance.${value}`)}</option>)}
    </Select><Button disabled={query.isFetching} onClick={() => { void query.refetch(); }} variant="secondary">{t('admin.maintenance.refresh')}</Button></div>
    {query.isPending ? <Spinner label={t('admin.maintenance.loading')} /> : null}
    {query.isError ? <p role="alert">{t('admin.maintenance.error')}</p> : null}
    {!query.isPending && !query.isError && !rows.length ? <p>{t('admin.maintenance.emptyJobs')}</p> : null}
    <div className="maintenance-jobs">{rows.map((job) => <article className="maintenance-job" key={job.id}>
      <h3>{t(`admin.maintenance.operations.${job.kind}`)}</h3>
      <p><strong>{t(`admin.maintenance.${job.state}`)}</strong> · {t('admin.maintenance.attempts')}: {job.attempts}</p>
      <p>{t('admin.maintenance.updated')}: {date(job.updatedAt)}</p>
      {job.state === 'pending' ? <p>{t('admin.maintenance.nextAttempt')}: {date(job.availableAt)}</p> : null}
      <p>{t(`admin.maintenance.${job.leaseExpired ? 'adviceStale' : job.state === 'failed' ? 'adviceFailed'
        : job.state === 'completed' ? 'adviceCompleted' : job.state === 'running' ? 'adviceRunning' : job.hasError ? 'adviceRetry' : 'advicePending'}`)}</p>
      <p>{t('admin.maintenance.reference')}: <code>{job.id}</code></p>
      {job.galleryId ? <Link to={`/admin/galleries/${encodeURIComponent(job.galleryId)}`}>{t('admin.maintenance.gallery')}</Link> : null}
    </article>)}</div>
    {query.hasNextPage ? <Button disabled={query.isFetching} onClick={() => { void query.fetchNextPage(); }} variant="secondary">{t('admin.maintenance.more')}</Button> : null}
  </>;
}
