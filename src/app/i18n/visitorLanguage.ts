/** Persist only a visitor's explicit choice, never the compiled or D1 default. */
export function rememberVisitorLanguage(language: 'fr' | 'en'): void {
  try {
    localStorage.setItem('cadrora-language', language);
  } catch {
    // A blocked preference store must not prevent the current language change.
  }
}
