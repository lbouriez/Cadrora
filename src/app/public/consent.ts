export type PrivacyConsent = 'analytics' | 'necessary';

const CONSENT_STORAGE_KEY = 'cadrora-privacy-consent-v1';
export const PRIVACY_PREFERENCES_EVENT = 'cadrora:privacy-preferences';

export function readPrivacyConsent(): PrivacyConsent | null {
  try {
    const value = localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'analytics' || value === 'necessary' ? value : null;
  } catch {
    return null;
  }
}

export function savePrivacyConsent(value: PrivacyConsent): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    // A blocked storage area leaves the choice session-only in the component.
  }
  window.dispatchEvent(new CustomEvent(PRIVACY_PREFERENCES_EVENT, { detail: value }));
}

export function openPrivacyPreferences(): void {
  window.dispatchEvent(new CustomEvent(PRIVACY_PREFERENCES_EVENT, { detail: 'open' }));
}
