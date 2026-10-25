// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Modal } from '../../../src/app/components/Modal';

afterEach(cleanup);

describe('modal focus and background isolation', () => {
  it('wraps over visible controls when the trailing thumbnail rail is hidden', () => {
    render(<Modal closeLabel="Close" onClose={() => {}} open title="Photo">
      <button type="button">Download</button>
      <div style={{ display: 'none' }}><button type="button">Hidden thumbnail</button></div>
      <div inert><button type="button">Inactive control</button></div>
    </Modal>);
    const close = screen.getByRole('button', { name: 'Close' });
    const download = screen.getByRole('button', { name: 'Download' });
    download.focus();
    fireEvent.keyDown(download, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(download);
  });

  it('restores the parent dialog and then the original background when nested dialogs close', () => {
    function Harness() {
      const [parentOpen, setParentOpen] = useState(false);
      const [childOpen, setChildOpen] = useState(false);
      return <>
        <button onClick={() => setParentOpen(true)} type="button">Open</button>
        <Modal closeLabel="Close parent" onClose={() => setParentOpen(false)} open={parentOpen} title="Parent">
          <button onClick={() => setChildOpen(true)} type="button">Open child</button>
          <Modal closeLabel="Close child" onClose={() => setChildOpen(false)} open={childOpen} title="Child">
            Child content
          </Modal>
        </Modal>
      </>;
    }
    const view = render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus(); fireEvent.click(trigger);
    const parent = screen.getByRole('dialog', { name: 'Parent' });
    const childTrigger = within(parent).getByRole('button', { name: 'Open child' });
    childTrigger.focus(); fireEvent.click(childTrigger);
    expect(view.container.hasAttribute('inert')).toBe(true);
    expect(parent.closest('.modal-backdrop')?.hasAttribute('inert')).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Child' }), { key: 'Escape' });
    expect(parent.closest('.modal-backdrop')?.hasAttribute('inert')).toBe(false);
    expect(view.container.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(childTrigger);
    fireEvent.keyDown(parent, { key: 'Escape' });
    expect(view.container.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps isolation when a lower modal closes before the upper modal', () => {
    const existing = document.createElement('aside');
    existing.setAttribute('inert', '');
    document.body.append(existing);
    const content = (lower: boolean, upper: boolean) => <>
      <Modal closeLabel="Close lower" onClose={() => {}} open={lower} title="Lower">Lower</Modal>
      <Modal closeLabel="Close upper" onClose={() => {}} open={upper} title="Upper">Upper</Modal>
    </>;
    const view = render(content(true, false));
    view.rerender(content(true, true));
    view.rerender(content(false, true));
    expect(view.container.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('dialog', { name: 'Upper' }).closest('.modal-backdrop')?.hasAttribute('inert')).toBe(false);
    view.rerender(content(false, false));
    expect(view.container.hasAttribute('inert')).toBe(false);
    expect(existing.hasAttribute('inert')).toBe(true);
    expect(document.body.style.overflow).toBe('');
    existing.remove();
  });
});
