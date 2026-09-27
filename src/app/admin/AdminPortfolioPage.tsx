import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { createImageEncoder } from '../../browser/images';
import {
  DeletePortfolioItemResponseSchema, PortfolioCollectionDetailSchema, PortfolioCollectionsSchema,
  PortfolioCategoriesSchema, PortfolioCategorySchema, PortfolioItemSchema, ServiceImageUploadResponseSchema,
} from '../../shared/schemas';
import type { PortfolioCategory, PortfolioCollectionDetail, PortfolioItem } from '../../shared/schemas';
import { BackLink, Button, ConfirmDialog, Dropzone, Input, Select, Spinner, Textarea } from '../components';
import { useAdminAccess } from './AdminAccessContext';
import { AdminCoverPhotoPicker } from './AdminCoverPhotoPicker';

async function apiJson<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  if (!response.ok) throw new Error(`Portfolio request returned ${response.status}`);
  return schema.parse(await response.json());
}

function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 80);
}

function PortfolioCategoryField({ categories, value, onChange, language, disabled }: {
  categories: PortfolioCategory[]; value: string; onChange: (id: string) => void;
  language: 'fr' | 'en'; disabled: boolean;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [nameFr, setNameFr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const add = async () => {
    if (busy || disabled || !nameFr.trim() || !nameEn.trim()) return;
    setBusy(true); setError(false);
    try {
      const category = await apiJson('/api/v1/admin/portfolio/categories', PortfolioCategorySchema, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copy: { fr: nameFr.trim(), en: nameEn.trim() } }),
      });
      await client.invalidateQueries({ queryKey: ['admin-portfolio-categories'] });
      onChange(category.id); setAdding(false); setNameFr(''); setNameEn('');
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <div className="admin-portfolio-category-field">
    <Select disabled={disabled || busy} label={t('admin.portfolio.category')} onChange={(event) => {
      if (event.target.value === '__new__') { onChange(''); setAdding(true); }
      else { setAdding(false); onChange(event.target.value); }
    }} value={adding ? '__new__' : value}>
      {!value && !adding ? <option value="">{t('admin.portfolio.chooseCategory')}</option> : null}
      {[...categories].sort((left, right) => left.copy[language].localeCompare(right.copy[language], language))
        .map((category) => <option key={category.id} value={category.id}>{category.copy[language]}</option>)}
      {!disabled ? <option value="__new__">{t('admin.portfolio.addCategory')}</option> : null}
    </Select>
    {adding ? <div className="admin-portfolio-category-field__new">
      <Input label={t('admin.portfolio.categoryFr')} maxLength={120} onChange={(event) => setNameFr(event.target.value)} value={nameFr} />
      <Input label={t('admin.portfolio.categoryEn')} maxLength={120} onChange={(event) => setNameEn(event.target.value)} value={nameEn} />
      <Button disabled={busy || !nameFr.trim() || !nameEn.trim()} onClick={() => { void add(); }} type="button" variant="secondary">{t('admin.portfolio.createCategory')}</Button>
      {error ? <p role="alert">{t('admin.portfolio.categoryError')}</p> : null}
    </div> : null}
  </div>;
}

async function uploadPhoto(id: string, file: File): Promise<void> {
  const encoder = createImageEncoder();
  try {
    const encoded = await encoder.encodeService(file);
    for (const variant of encoded.variants) {
      await apiJson(`/api/v1/admin/portfolio/${id}/image/${variant.name}`, ServiceImageUploadResponseSchema, {
        method: 'PUT', body: variant.blob, headers: {
          'Content-Type': variant.contentType,
          'X-Cadrora-Byte-Size': String(variant.byteSize),
          'X-Cadrora-Checksum-Sha256': variant.checksumSha256,
          'X-Cadrora-Height': String(variant.height),
          'X-Cadrora-Width': String(variant.width),
        },
      });
    }
    await apiJson(`/api/v1/admin/portfolio/${id}/publish`, PortfolioItemSchema, { method: 'POST' });
  } finally { encoder.dispose(); }
}

function PhotoEditor({ item, onChanged }: { item: PortfolioItem; onChanged: () => Promise<void> }) {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const [altFr, setAltFr] = useState(item.alt.fr);
  const [altEn, setAltEn] = useState(item.alt.en);
  const [sortOrder, setSortOrder] = useState(item.sortOrder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = async () => {
    if (readOnly || busy) return;
    setBusy(true); setError(false);
    try {
      await apiJson(`/api/v1/admin/portfolio/${item.id}`, PortfolioItemSchema, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: { fr: altFr.trim(), en: altEn.trim() }, sortOrder }),
      });
      await onChanged();
    } catch { setError(true); } finally { setBusy(false); }
  };
  const retryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || busy || readOnly) return;
    setBusy(true); setError(false);
    try { await uploadPhoto(item.id, file); await onChanged(); }
    catch { setError(true); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (readOnly || busy) return;
    setBusy(true); setError(false);
    try {
      await apiJson(`/api/v1/admin/portfolio/${item.id}`, DeletePortfolioItemResponseSchema, { method: 'DELETE' });
      await onChanged();
    } catch { setError(true); } finally { setBusy(false); setConfirmDelete(false); }
  };
  const preview = item.imageSources.find((source) => source.url.endsWith('/small')) ?? item.imageSources[0];
  return <article className="admin-portfolio-item">
    {preview ? <img alt={item.alt[language]}
      src={`/api/v1/admin/portfolio/${item.id}/image/${preview.url.split('/').at(-1)}`} /> : null}
    <div className="admin-portfolio-item__fields">
      <p>{t(item.state === 'published' ? 'admin.portfolio.published' : 'admin.portfolio.pending')}</p>
      <Input label={t('admin.portfolio.altFr')} maxLength={200} onChange={(event) => setAltFr(event.target.value)} required value={altFr} />
      <Input label={t('admin.portfolio.altEn')} maxLength={200} onChange={(event) => setAltEn(event.target.value)} required value={altEn} />
      <Input label={t('admin.portfolio.order')} min="0" onChange={(event) => setSortOrder(Number(event.target.value))} required type="number" value={sortOrder} />
      {item.state === 'pending' ? <label className="field"><span className="field__label">{t('admin.portfolio.upload')}</span>
        <input accept="image/jpeg,image/png,image/webp" className="field__input" disabled={busy || readOnly}
          onChange={(event) => { void retryUpload(event); }} type="file" />
        <span className="field__hint">{t('admin.portfolio.uploadHint')}</span>
      </label> : null}
      <div className="admin-portfolio-item__actions">
        <Button disabled={busy || readOnly} onClick={() => { void save(); }}>{t('admin.portfolio.save')}</Button>
        <Button disabled={busy || readOnly} onClick={() => setConfirmDelete(true)} variant="danger">{t('admin.portfolio.remove')}</Button>
      </div>
      {error ? <p role="alert">{t('admin.portfolio.error')}</p> : null}
    </div>
    <ConfirmDialog cancelLabel={t('admin.portfolio.cancel')} closeLabel={t('admin.portfolio.cancel')}
      confirmLabel={t('admin.portfolio.remove')} isConfirming={busy} onCancel={() => setConfirmDelete(false)}
      onConfirm={() => { void remove(); }} open={confirmDelete} title={t('admin.portfolio.removeTitle')}>
      <p>{t('admin.portfolio.removeBody')}</p>
    </ConfirmDialog>
  </article>;
}

function CollectionList({ categories }: { categories: PortfolioCategory[] }) {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const navigate = useNavigate();
  const client = useQueryClient();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const collections = useQuery({ queryFn: () => apiJson('/api/v1/admin/portfolio/collections', PortfolioCollectionsSchema),
    queryKey: ['admin-portfolio-collections'] });
  const [titleFr, setTitleFr] = useState(''); const [titleEn, setTitleEn] = useState('');
  const [descriptionFr, setDescriptionFr] = useState(''); const [descriptionEn, setDescriptionEn] = useState('');
  const [slug, setSlug] = useState(''); const [slugEdited, setSlugEdited] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy || readOnly) return;
    setBusy(true); setError(false);
    try {
      const created = await apiJson('/api/v1/admin/portfolio/collections', PortfolioCollectionDetailSchema, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, categoryId, copy: {
          fr: { title: titleFr.trim(), description: descriptionFr.trim() },
          en: { title: titleEn.trim(), description: descriptionEn.trim() },
        } }),
      });
      await client.invalidateQueries({ queryKey: ['admin-portfolio-collections'] });
      void navigate(`/admin/portfolio/${created.id}`);
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <div className="admin-workspace">
    <section className="admin-card">
      <h1 className="admin-card__title">{t('admin.portfolio.title')}</h1>
      <p className="admin-card__description">{t('admin.portfolio.description')}</p>
      <h2 className="admin-card__title admin-portfolio-collections__title">{t('admin.portfolio.collections')}</h2>
      {collections.isPending ? <Spinner label={t('admin.portfolio.loading')} /> : null}
      {collections.isError ? <p role="alert">{t('admin.portfolio.error')}</p> : null}
      {collections.data?.length === 0 ? <p>{t('admin.portfolio.empty')}</p> : null}
      <div className="admin-event-list">{collections.data?.map((collection) => <article className="admin-event-row" key={collection.id}>
        {collection.coverSources[0] ? <img alt="" className="admin-portfolio-collection__cover"
          src={collection.coverSources[0].url.replace(/^\/portfolio-media\/([^/]+)\//u, '/api/v1/admin/portfolio/$1/image/')} /> : null}
        <div><div className="admin-event-row__meta">
          <span className="admin-event-row__state">{t(collection.published ? 'admin.portfolio.published' : 'admin.portfolio.draft')}</span>
          <span className="admin-event-row__badge">{categories.find((category) => category.id === collection.categoryId)?.copy[language] ?? collection.copy[language].title}</span>
          <span className="admin-event-row__badge">{t('admin.portfolio.photoCount', { count: collection.photoCount })}</span>
        </div><h3>{collection.copy[language].title}</h3><p>{collection.copy[language].description}</p>
        </div>
        <div className="admin-event-row__actions"><Link className="button button--secondary" to={`/admin/portfolio/${collection.id}`}>
          {t('admin.portfolio.manage')}</Link></div>
      </article>)}</div>
    </section>
    <section className="admin-card">
      <h2 className="admin-card__title">{t('admin.portfolio.addCollection')}</h2>
      <form className="admin-event-form" onSubmit={(event) => { void submit(event); }}>
        <Input label={t('admin.portfolio.titleFr')} maxLength={160} onChange={(event) => {
          setTitleFr(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value));
        }} required value={titleFr} />
        <Input label={t('admin.portfolio.titleEn')} maxLength={160} onChange={(event) => setTitleEn(event.target.value)} required value={titleEn} />
        <Input label={t('admin.portfolio.slug')} maxLength={80} onChange={(event) => {
          setSlugEdited(true); setSlug(slugify(event.target.value));
        }} required value={slug} />
        <Textarea label={t('admin.portfolio.descriptionFr')} maxLength={2000} onChange={(event) => setDescriptionFr(event.target.value)} value={descriptionFr} />
        <Textarea label={t('admin.portfolio.descriptionEn')} maxLength={2000} onChange={(event) => setDescriptionEn(event.target.value)} value={descriptionEn} />
        <PortfolioCategoryField categories={categories} disabled={readOnly} language={language} onChange={setCategoryId} value={categoryId} />
        <Button disabled={busy || readOnly || !categoryId} type="submit">{t('admin.portfolio.addCollection')}</Button>
        {error ? <p role="alert">{t('admin.portfolio.error')}</p> : null}
      </form>
    </section>
  </div>;
}

function CollectionEditor({ id, categories }: { id: string; categories: PortfolioCategory[] }) {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const navigate = useNavigate(); const client = useQueryClient();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const detail = useQuery({ queryFn: () => apiJson(`/api/v1/admin/portfolio/collections/${id}`, PortfolioCollectionDetailSchema),
    queryKey: ['admin-portfolio-collection', id] });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = async () => { await Promise.all([
    client.invalidateQueries({ queryKey: ['admin-portfolio-collection', id] }),
    client.invalidateQueries({ queryKey: ['admin-portfolio-collections'] }),
    client.invalidateQueries({ queryKey: ['public-portfolio'] }),
  ]); };
  if (detail.isPending) return <Spinner label={t('admin.portfolio.loading')} />;
  if (detail.isError || !detail.data) return <p role="alert">{t('admin.portfolio.error')}</p>;
  return <CollectionFields collection={detail.data} error={error} busy={busy} progress={progress}
    key={`${id}:${detail.data.photos.map((photo) => photo.id).join(',')}`}
    categories={categories} language={language} readOnly={readOnly} confirmDelete={confirmDelete}
    onConfirmDelete={setConfirmDelete} onSave={async (updated) => {
      setBusy(true); setError(false);
      try {
        await apiJson(`/api/v1/admin/portfolio/collections/${id}`, PortfolioCollectionDetailSchema, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated),
        }); await refresh();
      } catch { setError(true); } finally { setBusy(false); }
    }} onUpload={async (files) => {
      if (!files.length || busy || readOnly) return;
      setBusy(true); setError(false); setProgress({ done: 0, total: files.length });
      try {
        for (const [index, file] of files.entries()) {
          const alt = file.name.replace(/\.[^.]+$/u, '').replace(/[-_]+/gu, ' ').trim() || file.name;
          const photo = await apiJson('/api/v1/admin/portfolio', PortfolioItemSchema, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collectionId: id, alt: { fr: alt.slice(0, 200), en: alt.slice(0, 200) } }),
          });
          await uploadPhoto(photo.id, file);
          setProgress({ done: index + 1, total: files.length });
        }
        await refresh();
      } catch { setError(true); await refresh(); } finally { setBusy(false); setProgress(null); }
    }} onDelete={async () => {
      setBusy(true); setError(false);
      try {
        await apiJson(`/api/v1/admin/portfolio/collections/${id}`, DeletePortfolioItemResponseSchema, { method: 'DELETE' });
        await refresh(); void navigate('/admin/portfolio');
      } catch { setError(true); } finally { setBusy(false); setConfirmDelete(false); }
    }} refresh={refresh} />;
}

function CollectionFields({ collection, categories, language, readOnly, busy, error, progress, confirmDelete,
  onConfirmDelete, onSave, onUpload, onDelete, refresh }: {
  collection: PortfolioCollectionDetail; categories: PortfolioCategory[]; language: 'fr' | 'en'; readOnly: boolean;
  busy: boolean; error: boolean; progress: { done: number; total: number } | null; confirmDelete: boolean;
  onConfirmDelete: (open: boolean) => void;
  onSave: (value: { slug: string; categoryId: string; copy: PortfolioCollectionDetail['copy']; sortOrder: number;
    published: boolean; coverPhotoId: string | null }) => Promise<void>;
  onUpload: (files: File[]) => Promise<void>; onDelete: () => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [titleFr, setTitleFr] = useState(collection.copy.fr.title);
  const [titleEn, setTitleEn] = useState(collection.copy.en.title);
  const [descriptionFr, setDescriptionFr] = useState(collection.copy.fr.description);
  const [descriptionEn, setDescriptionEn] = useState(collection.copy.en.description);
  const [slug, setSlug] = useState(collection.slug);
  const [categoryId, setCategoryId] = useState(collection.categoryId);
  const [sortOrder, setSortOrder] = useState(collection.sortOrder);
  const [published, setPublished] = useState(collection.published);
  const [coverPhotoId, setCoverPhotoId] = useState(collection.coverPhotoId ?? '');
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave({ slug, categoryId, sortOrder, published, coverPhotoId: coverPhotoId || null,
      copy: { fr: { title: titleFr.trim(), description: descriptionFr.trim() },
        en: { title: titleEn.trim(), description: descriptionEn.trim() } } });
  };
  return <div className="admin-workspace">
    <BackLink to="/admin/portfolio">{t('admin.portfolio.back')}</BackLink>
    <section className="admin-card">
      <h1 className="admin-card__title">{collection.copy[language].title}</h1>
      <form className="admin-event-form" onSubmit={save}>
        <Input label={t('admin.portfolio.titleFr')} maxLength={160} onChange={(event) => setTitleFr(event.target.value)} required value={titleFr} />
        <Input label={t('admin.portfolio.titleEn')} maxLength={160} onChange={(event) => setTitleEn(event.target.value)} required value={titleEn} />
        <Input label={t('admin.portfolio.slug')} maxLength={80} onChange={(event) => setSlug(slugify(event.target.value))} required value={slug} />
        <Textarea label={t('admin.portfolio.descriptionFr')} maxLength={2000} onChange={(event) => setDescriptionFr(event.target.value)} value={descriptionFr} />
        <Textarea label={t('admin.portfolio.descriptionEn')} maxLength={2000} onChange={(event) => setDescriptionEn(event.target.value)} value={descriptionEn} />
        <PortfolioCategoryField categories={categories} disabled={busy || readOnly} language={language} onChange={setCategoryId} value={categoryId} />
        <Input label={t('admin.portfolio.collectionOrder')} min="0" onChange={(event) => setSortOrder(Number(event.target.value))} required type="number" value={sortOrder} />
        <div className="admin-cover">
          <h2 className="admin-card__title">{t('admin.portfolio.cover')}</h2>
          <p className="admin-card__description">{t('admin.portfolio.coverDescription')}</p>
          <AdminCoverPhotoPicker choices={collection.photos.filter((photo) => photo.state === 'published')
            .map((photo) => ({
              id: photo.id, label: photo.alt[language],
              thumbnailUrl: `/api/v1/admin/portfolio/${encodeURIComponent(photo.id)}/image/small`,
            }))} disabled={busy || readOnly} labels={{
              choose: (filename) => t('admin.portfolio.coverChoose', { filename }),
              clear: t('admin.portfolio.firstPhoto'), current: t('admin.portfolio.coverCurrent'),
              empty: t('admin.portfolio.coverEmpty'),
            }} onSelect={(id) => setCoverPhotoId(id ?? '')} selectedId={coverPhotoId || null} />
        </div>
        <label className="admin-portfolio-visibility"><input checked={published}
          disabled={busy || readOnly || !collection.photos.some((photo) => photo.state === 'published')}
          onChange={(event) => setPublished(event.target.checked)} type="checkbox" /> {t('admin.portfolio.visible')}</label>
        {!collection.photos.some((photo) => photo.state === 'published') ? <p className="field__hint">{t('admin.portfolio.publishHint')}</p> : null}
        <div className="admin-portfolio-item__actions">
          <Button disabled={busy || readOnly || !categoryId} type="submit">{t('admin.portfolio.save')}</Button>
          <Button disabled={busy || readOnly} onClick={() => onConfirmDelete(true)} type="button" variant="danger">{t('admin.portfolio.deleteCollection')}</Button>
        </div>
        {error ? <p role="alert">{t('admin.portfolio.error')}</p> : null}
      </form>
      {collection.published ? <Link className="button button--secondary" to={`/portfolio/${collection.slug}`}>{t('admin.portfolio.viewPublic')}</Link> : null}
    </section>
    <section className="admin-card">
      <h2 className="admin-card__title">{t('admin.portfolio.photos')}</h2>
      <Dropzone accept="image/jpeg,image/png,image/webp" description={t('admin.portfolio.uploadHint')}
        disabled={busy || readOnly} label={t('admin.portfolio.addPhotos')} onFiles={(files) => { void onUpload(files); }} />
      {progress ? <p role="status">{t('admin.portfolio.uploadProgress', progress)}</p> : null}
      {!collection.photos.length ? <p>{t('admin.portfolio.emptyPhotos')}</p> : null}
      <div className="admin-portfolio-list">{collection.photos.map((photo) => <PhotoEditor item={photo} key={photo.id} onChanged={refresh} />)}</div>
    </section>
    <ConfirmDialog cancelLabel={t('admin.portfolio.cancel')} closeLabel={t('admin.portfolio.cancel')}
      confirmLabel={t('admin.portfolio.deleteCollection')} isConfirming={busy} onCancel={() => onConfirmDelete(false)}
      onConfirm={() => { void onDelete(); }} open={confirmDelete} title={t('admin.portfolio.deleteCollectionTitle')}>
      <p>{t('admin.portfolio.deleteCollectionBody')}</p>
    </ConfirmDialog>
  </div>;
}

export function AdminPortfolioPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const categories = useQuery({ queryFn: () => apiJson('/api/v1/admin/portfolio/categories', PortfolioCategoriesSchema), queryKey: ['admin-portfolio-categories'] });
  if (categories.isPending) return <Spinner label={t('admin.portfolio.loading')} />;
  if (categories.isError || !categories.data) return <p role="alert">{t('admin.portfolio.error')}</p>;
  return id ? <CollectionEditor categories={categories.data} id={id} key={id} /> : <CollectionList categories={categories.data} />;
}
