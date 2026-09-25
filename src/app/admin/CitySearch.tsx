import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PlaceSuggestionsResponseSchema } from '../../shared/schemas';

interface City {
  label: string;
  latitude: number;
  longitude: number;
}

function placeLabel(place: { properties: { name: string; state?: string | undefined; country?: string | undefined } }): string {
  return [place.properties.name, place.properties.state, place.properties.country].filter(Boolean).join(', ');
}

/** Optional, admin-only city lookup. Manual coordinates remain available if Photon is offline. */
export function CitySearch({ onSelect }: { onSelect: (city: City) => void }) {
  const { i18n, t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedQuery, setSelectedQuery] = useState('');
  const [suggestions, setSuggestions] = useState<City[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const resultsId = useId();

  useEffect(() => {
    const search = query.trim();
    if (search.length < 3 || search === selectedQuery) return;
    const controller = new AbortController();
    const loadSuggestions = async () => {
      setStatus('loading');
      const params = new URLSearchParams({ q: search, limit: '5', lang: i18n.resolvedLanguage?.startsWith('fr') ? 'fr' : 'en' });
      for (const type of ['city', 'town', 'village', 'hamlet']) params.append('osm_tag', `place:${type}`);
      try {
        const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`City lookup returned ${response.status}`);
        const parsed = PlaceSuggestionsResponseSchema.parse(await response.json());
        const cities = parsed.features.map((place) => ({
          label: placeLabel(place),
          latitude: place.geometry.coordinates[1],
          longitude: place.geometry.coordinates[0],
        }));
        setSuggestions(cities);
        setStatus(cities.length ? 'idle' : 'empty');
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setStatus('error');
        }
      }
    };
    const timer = window.setTimeout(() => { void loadSuggestions(); }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [i18n.resolvedLanguage, query, selectedQuery]);

  return (
    <div className="admin-city-search">
      <label className="field" htmlFor={resultsId}>
        <span className="field__label">{t('admin.settings.mapCity')}</span>
        <input
          aria-controls={`${resultsId}-results`}
          aria-expanded={suggestions.length > 0}
          autoComplete="off"
          className="field__input"
          id={resultsId}
          onChange={(event) => { setQuery(event.target.value); setSuggestions([]); setStatus('idle'); }}
          placeholder={t('admin.settings.mapCityPlaceholder')}
          type="search"
          value={query}
        />
        <span className="field__hint">{t('admin.settings.mapCityHint')}</span>
      </label>
      {suggestions.length > 0 ? <ul className="admin-city-search__results" id={`${resultsId}-results`}>
        {suggestions.map((city) => <li key={`${city.label}-${city.latitude}-${city.longitude}`}>
          <button onClick={() => { onSelect(city); setQuery(city.label); setSelectedQuery(city.label); setSuggestions([]); }} type="button">{city.label}</button>
        </li>)}
      </ul> : null}
      {status !== 'idle' ? <p className="field__hint" role="status">{t(`admin.settings.mapCity${status === 'loading' ? 'Loading' : status === 'empty' ? 'Empty' : 'Error'}`)}</p> : null}
    </div>
  );
}
