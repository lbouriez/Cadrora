import { useRef, useState } from 'react';
import type { SetStateAction } from 'react';

interface Draft<T> { value: T; saved: T }

// Keep only public website copy/settings, never credentials or photo contents.
// This tab-local memory survives route changes; leaving/reloading the document
// requires the browser's unsaved-changes confirmation instead of storing drafts.
const drafts = new Map<string, Draft<unknown>>();
let ownerSession: string | null | undefined;
let generation = 0;
const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  event.returnValue = '';
};

function syncUnloadWarning() {
  window.removeEventListener('beforeunload', warnBeforeLeaving);
  if (drafts.size) window.addEventListener('beforeunload', warnBeforeLeaving);
}

/** Logout or a confirmed session change discards the previous owner's local edits. */
export function clearAdminDrafts() {
  generation += 1;
  drafts.clear();
  syncUnloadWarning();
}

export function syncAdminDraftSession(identity: string | null) {
  if (identity === null || (ownerSession !== undefined && ownerSession !== identity)) clearAdminDrafts();
  ownerSession = identity;
}

function rememberDraft<T>(key: string, draft: Draft<T>) {
  if (JSON.stringify(draft.value) !== JSON.stringify(draft.saved)) drafts.set(key, draft);
  else drafts.delete(key);
  syncUnloadWarning();
}

export function useAdminDraft<T>(key: string, initial: T, enabled = true) {
  // Every key has one editor-owned value type. Values never cross an external boundary.
  const [draft, setDraft] = useState<Draft<T>>(() => enabled
    ? drafts.get(key) as Draft<T> | undefined ?? { value: initial, saved: initial }
    : { value: initial, saved: initial });
  const latest = useRef(draft);
  const editorGeneration = useRef(generation);
  const dirty = enabled && JSON.stringify(draft.value) !== JSON.stringify(draft.saved);
  const update = (next: Draft<T>) => {
    latest.current = next;
    // Persist/clear synchronously: a successful create can unmount this editor
    // before a React effect runs. New edits made during a save remain dirty.
    if (enabled && editorGeneration.current === generation) rememberDraft(key, next);
    setDraft(next);
  };
  const setValue = (next: SetStateAction<T>) => update({ ...latest.current,
    value: typeof next === 'function' ? (next as (value: T) => T)(latest.current.value) : next });
  const markSaved = (value: T) => update({ ...latest.current, saved: value });
  return { value: draft.value, setValue, markSaved, dirty };
}
