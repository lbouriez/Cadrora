import { useTranslation } from 'react-i18next';

import { GalleryServiceSchema } from '../../shared/schemas/event';
import type { Event } from '../../shared/schemas/event';
import { Select } from '../components';

/** Shared optional category selector for gallery creation and settings. */
export function GalleryServiceField({ value }: { value: Event['service'] }) {
  const { t } = useTranslation();
  return <Select defaultValue={value ?? ''} hint={t('admin.events.serviceHint')} label={t('admin.events.service')} name="service">
    <option value="">{t('admin.events.serviceNone')}</option>
    {GalleryServiceSchema.options.map((service) => <option key={service} value={service}>{t(`gallery.category.${service}`)}</option>)}
  </Select>;
}
