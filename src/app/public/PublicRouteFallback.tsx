import { useTranslation } from 'react-i18next';

import { Spinner } from '../components';
import { PublicLayout } from './PublicLayout';

export function PublicRouteFallback() {
  const { t } = useTranslation();
  return <PublicLayout><Spinner label={t('gallery.loading')} /></PublicLayout>;
}
