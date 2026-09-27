import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { Language } from '../../shared/schemas';
import { Button, Input, LanguageIcon, Modal, Textarea } from '../components';

type LocalizedValues = Partial<Record<Language, string>>;

interface LocalizedTextFieldProps {
  enabledLanguages: readonly Language[];
  label: string;
  languages: readonly Language[];
  maxLength: number;
  multiline?: boolean;
  onChange: (language: Language, value: string) => void;
  primaryLanguage: Language;
  required?: boolean;
  values: LocalizedValues;
}

/** One visible admin field with a shared, locally edited translation dialog. The parent saves all values together. */
export function LocalizedTextField({
  enabledLanguages, label, languages, maxLength, multiline = false, onChange, primaryLanguage, required = false, values,
}: LocalizedTextFieldProps) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const displayNames = new Intl.DisplayNames([locale], { type: 'language' });
  const languageName = (language: Language) => {
    const name = displayNames.of(language) ?? language.toUpperCase();
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  };
  const hasCopy = enabledLanguages.some((language) => Boolean(values[language]?.trim()));
  const missingCount = required || hasCopy
    ? enabledLanguages.filter((language) => !values[language]?.trim()).length
    : 0;
  const fieldProps = {
    maxLength,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(primaryLanguage, event.target.value),
    value: values[primaryLanguage] ?? '',
  };

  return (
    <div className="admin-localized-field">
      <div className="admin-localized-field__main">
        {multiline
          ? <Textarea {...fieldProps} label={`${label} · ${languageName(primaryLanguage)}`} required={required} rows={3} />
          : <Input {...fieldProps} label={`${label} · ${languageName(primaryLanguage)}`} required={required} />}
        <Button
          aria-label={`${t('admin.settings.translationsFor', { field: label })}${missingCount ? ` · ${t('admin.settings.translationsMissing', { count: missingCount })}` : ''}`}
          aria-haspopup="dialog"
          className={`admin-localized-field__trigger${missingCount ? ' admin-localized-field__trigger--missing' : ''}`}
          onClick={() => setOpen(true)}
          variant="secondary"
        >
          <LanguageIcon />
          <span>{t('admin.settings.translations')}</span>
          {missingCount ? <span aria-hidden="true" className="admin-localized-field__count">{missingCount}</span> : null}
        </Button>
      </div>
      <Modal
        closeLabel={t('admin.settings.translationsClose')}
        onClose={() => setOpen(false)}
        open={open}
        title={t('admin.settings.translationsFor', { field: label })}
      >
        <p className="admin-card__description">{t('admin.settings.translationsHint')}</p>
        <div className="admin-localized-field__translations">
          {languages.map((language) => {
            const translatedProps = {
              maxLength,
              onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(language, event.target.value),
              value: values[language] ?? '',
            };
            return multiline
              ? <Textarea {...translatedProps} key={language} label={languageName(language)} rows={3} />
              : <Input {...translatedProps} key={language} label={languageName(language)} />;
          })}
        </div>
        <Button onClick={() => setOpen(false)} variant="secondary">{t('admin.settings.translationsClose')}</Button>
      </Modal>
    </div>
  );
}
