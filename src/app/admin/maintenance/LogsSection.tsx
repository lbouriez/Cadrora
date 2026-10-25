import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_LOG_RETENTION_DAYS, LogLevelSchema, LogSourceSchema } from '../../../shared/schemas/maintenance';
import type { z } from '../../../shared/zod';
import { Button, Select, Spinner } from '../../components';
import { getApplicationLogs } from './api';

const eventLabels: Record<string, string> = { MAINTENANCE_RUN_COMPLETED: 'runCompleted', MAINTENANCE_RUN_FAILED: 'runFailed', MAINTENANCE_OPERATION_FAILED: 'operationFailed' };
const levelLabels = { info: 'info', warn: 'warn', error: 'errorLevel' } as const;
const sourceLabels = { http: 'http', maintenance: 'maintenanceSource', scheduler: 'schedulerSource' } as const;
export function LogsSection() {
  const { i18n, t } = useTranslation();
  const [level, setLevel] = useState<z.infer<typeof LogLevelSchema> | ''>('');
  const [source, setSource] = useState<z.infer<typeof LogSourceSchema> | ''>('');
  const query = useInfiniteQuery({ queryKey: ['maintenance', 'logs', level, source], initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (level) params.set('level', level);
      if (source) params.set('source', source);
      if (pageParam) params.set('before', String(pageParam));
      return getApplicationLogs(params);
    }, getNextPageParam: (page) => page.nextBefore, retry: false, refetchOnWindowFocus: false });
  const rows = query.data?.pages.flatMap((page) => page.logs) ?? [];
  return <>
    <h2>{t('admin.maintenance.logs')}</h2><p>{t('admin.maintenance.logsNote')}</p>
    <p>{t('admin.maintenance.retention', { days: APP_LOG_RETENTION_DAYS })}</p>
    <div className="maintenance-filters">
      <Select label={t('admin.maintenance.level')} value={level} onChange={(event) => setLevel(event.target.value ? LogLevelSchema.parse(event.target.value) : '')}>
        <option value="">{t('admin.maintenance.all')}</option>{LogLevelSchema.options.map((value) => <option key={value} value={value}>{t(`admin.maintenance.${levelLabels[value]}`)}</option>)}
      </Select>
      <Select label={t('admin.maintenance.source')} value={source} onChange={(event) => setSource(event.target.value ? LogSourceSchema.parse(event.target.value) : '')}>
        <option value="">{t('admin.maintenance.all')}</option>{LogSourceSchema.options.map((value) => <option key={value} value={value}>{t(`admin.maintenance.${sourceLabels[value]}`)}</option>)}
      </Select>
      <Button disabled={query.isFetching} onClick={() => { void query.refetch(); }} variant="secondary">{t('admin.maintenance.refresh')}</Button>
    </div>
    {query.isPending ? <Spinner label={t('admin.maintenance.loading')} /> : null}
    {query.isError ? <p role="alert">{t('admin.maintenance.error')}</p> : null}
    {!query.isPending && !query.isError && !rows.length ? <p>{t('admin.maintenance.emptyLogs')}</p> : null}
    {rows.length ? <div className="admin-table-scroll" role="region" aria-label={t('admin.maintenance.logs')} tabIndex={0}><table className="maintenance-log-table"><thead><tr>
      <th scope="col">{t('admin.maintenance.time')}</th><th scope="col">{t('admin.maintenance.level')}</th>
      <th scope="col">{t('admin.maintenance.event')}</th><th scope="col">{t('admin.maintenance.reference')}</th>
    </tr></thead><tbody>{rows.map((log) => <tr key={log.id}>
      <td>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(log.occurredAt))}</td>
      <td>{t(`admin.maintenance.${levelLabels[log.level]}`)}<br />{t(`admin.maintenance.${sourceLabels[log.source]}`)}</td>
      <td>{eventLabels[log.code] ? <p>{t(`admin.maintenance.${eventLabels[log.code]}`)}</p> : null}<code>{log.code}</code>
        {log.source === 'http' ? <p>{log.method} · {log.routeGroup}</p> : null}
        {log.jobKind ? <p>{t(`admin.maintenance.operations.${log.jobKind}`)}</p> : null}</td>
      <td>{t('admin.maintenance.request')}: <code>{log.requestId}</code>{log.jobId ? <p>{t('admin.maintenance.jobHelp')}: <code>{log.jobId}</code></p> : null}</td>
    </tr>)}</tbody></table></div> : null}
    {query.hasNextPage ? <Button disabled={query.isFetching} onClick={() => { void query.fetchNextPage(); }} variant="secondary">{t('admin.maintenance.more')}</Button> : null}
  </>;
}
