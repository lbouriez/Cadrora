// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { clearAdminDrafts, syncAdminDraftSession, useAdminDraft } from '../../../src/app/admin/useAdminDraft';

function Editor() {
  const draft = useAdminDraft('session-test', 'Original');
  return <><input aria-label="Copy" onChange={(event) => draft.setValue(event.target.value)} value={draft.value} />
    <button type="button" onClick={() => draft.markSaved('First edit')}>Complete earlier save</button></>;
}
afterEach(() => { cleanup(); clearAdminDrafts(); });

describe('admin draft lifecycle', () => {
  it('keeps later edits when an earlier save completes', () => {
    const view = render(<Editor />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Second edit' } });
    fireEvent.click(screen.getByRole('button'));
    view.unmount(); render(<Editor />);
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Second edit');
  });

  it.each([null, 'another-owner'])('clears drafts on a confirmed session transition to %s', (identity) => {
    syncAdminDraftSession('initial-owner');
    const view = render(<Editor />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Private draft' } });
    syncAdminDraftSession(identity);
    // A response still completing in the old editor must not revive its draft.
    fireEvent.click(screen.getByRole('button'));
    view.unmount(); render(<Editor />);
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'Original');
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(false);
  });
});
