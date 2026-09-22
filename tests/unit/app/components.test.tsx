// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Badge,
  ConfirmDialog,
  Drawer,
  EmptyState,
  IconButton,
  MultiSelect,
  Pagination,
  Select,
  Tabs,
  Textarea,
} from '../../../src/app/components';

function TabsHarness() {
  const [selectedId, setSelectedId] = useState('details');
  return (
    <Tabs
      label="Sections"
      onSelectedIdChange={setSelectedId}
      selectedId={selectedId}
      tabs={[
        { content: <p>Details panel</p>, id: 'details', label: 'Details' },
        { content: <p>Settings panel</p>, id: 'settings', label: 'Settings' },
      ]}
    />
  );
}

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">Open filters</button>
      <Drawer closeLabel="Close filters" onClose={() => setOpen(false)} open={open} title="Filters">
        <button type="button">Apply</button>
      </Drawer>
    </>
  );
}

function MultiSelectHarness() {
  const [values, setValues] = useState<Array<'en' | 'fr'>>(['fr']);
  return (
    <MultiSelect
      label="Languages"
      onChange={setValues}
      options={[{ label: 'French', value: 'fr' }, { label: 'English', value: 'en' }]}
      values={values}
    />
  );
}

afterEach(cleanup);

describe('shared components', () => {
  it('connects labelled multiline and select fields to translated hints or errors', () => {
    render(
      <>
        <Textarea error="Required description" label="Description" name="description" />
        <Select hint="Choose access" label="Access" name="access">
          <option value="public">Public</option>
        </Select>
      </>,
    );

    expect(screen.getByLabelText('Description').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Required description');
    expect(screen.getByLabelText('Access').getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('Choose access')).toBeTruthy();
  });

  it('keeps tab keyboard navigation and pagination controls accessible', () => {
    const onPageChange = vi.fn();
    render(
      <>
        <TabsHarness />
        <Pagination
          currentPage={2}
          label="Pages"
          nextLabel="Next page"
          onPageChange={onPageChange}
          pageCount={3}
          previousLabel="Previous page"
        />
      </>,
    );

    const details = screen.getByRole('tab', { name: 'Details' });
    fireEvent.keyDown(details, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Settings' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Settings panel')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByRole('button', { name: 'Previous page' }).getAttribute('disabled')).toBeNull();
  });

  it('retains a selected tab when used without controlled state', () => {
    render(
      <Tabs
        label="Sections"
        tabs={[
          { content: <p>Details panel</p>, id: 'details', label: 'Details' },
          { content: <p>Settings panel</p>, id: 'settings', label: 'Settings' },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByText('Settings panel')).toBeTruthy();
  });

  it('supports multiple selections while preserving at least one choice', () => {
    render(<MultiSelectHarness />);
    fireEvent.click(screen.getByText('French', { selector: 'summary' }));
    const french = screen.getByRole<HTMLInputElement>('checkbox', { name: 'French' });
    const english = screen.getByRole<HTMLInputElement>('checkbox', { name: 'English' });
    expect(french.disabled).toBe(true);
    fireEvent.click(english);
    expect(english.checked).toBe(true);
    expect(french.disabled).toBe(false);
  });

  it('closes focus-managed drawers with Escape and restores the trigger focus', () => {
    render(<DrawerHarness />);

    const trigger = screen.getByRole('button', { name: 'Open filters' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close filters' }));

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('renders semantic status, empty state, icon action, and confirmation action', () => {
    const onConfirm = vi.fn();
    render(
      <>
        <Badge variant="success">Ready</Badge>
        <EmptyState description="Nothing published" title="No galleries" />
        <IconButton aria-label="Close">×</IconButton>
        <ConfirmDialog
          cancelLabel="Cancel"
          closeLabel="Close confirmation"
          confirmLabel="Delete"
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          open
          title="Delete gallery"
        >
          <p>This cannot be undone.</p>
        </ConfirmDialog>
      </>,
    );

    expect(screen.getByText('Ready').classList.contains('badge--success')).toBe(true);
    expect(screen.getByRole('heading', { name: 'No galleries' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close' }).classList.contains('icon-button')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
