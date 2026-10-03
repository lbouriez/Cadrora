import { useTranslation } from 'react-i18next';

import { isMarketingPhotoCompression } from '../../browser/images/marketingCompression';
import type { MarketingPhotoCompression } from '../../browser/images/marketingCompression';
import { Select } from '../components';

/** Shared by every marketing-photo upload, independent of the selected site profile. */
export function PhotoCompressionField({ value, onChange, disabled }: {
  value: MarketingPhotoCompression; onChange: (value: MarketingPhotoCompression) => void; disabled: boolean;
}) {
  const { t } = useTranslation();
  return <Select disabled={disabled} hint={t(`admin.photoCompression.${value}Hint`)}
    label={t('admin.photoCompression.label')} onChange={(event) => {
      if (isMarketingPhotoCompression(event.target.value)) onChange(event.target.value);
    }} value={value}>
    <option value="balanced">{t('admin.photoCompression.balanced')}</option>
    <option value="lighter">{t('admin.photoCompression.lighter')}</option>
  </Select>;
}
