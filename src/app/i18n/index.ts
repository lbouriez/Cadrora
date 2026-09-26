import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from './resources';

type SupportedLanguage = 'en' | 'fr';

function supportedLanguage(value: string | null | undefined): SupportedLanguage | null {
  if (value?.toLowerCase().startsWith('en')) return 'en';
  if (value?.toLowerCase().startsWith('fr')) return 'fr';
  return null;
}

let savedLanguage: string | null = null;
try {
  savedLanguage = localStorage.getItem('cadrora-language');
} catch {
  // A blocked preference store must not block the static website.
}
const initialLanguage = supportedLanguage(savedLanguage)
  ?? supportedLanguage(import.meta.env.VITE_SITE_DEFAULT_LANG)
  ?? __CADRORA_SITE_DEFAULT_LANG__;

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'fr',
  supportedLngs: ['fr', 'en'],
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = supportedLanguage(language) ?? 'fr';
});

document.documentElement.lang = initialLanguage;

export { i18n };
