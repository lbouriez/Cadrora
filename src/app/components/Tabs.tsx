import { useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

/** Keyboard-navigable tabs. Example: <Tabs label={t('sections')} tabs={[{ id: 'details', label: t('details'), content }]} />. */
export interface TabDefinition {
  content: ReactNode;
  disabled?: boolean;
  id: string;
  label: string;
}

export interface TabsProps {
  label: string;
  onSelectedIdChange?: (id: string) => void;
  selectedId?: string;
  tabs: readonly TabDefinition[];
}

export function Tabs({ label, onSelectedIdChange, selectedId, tabs }: TabsProps) {
  const generatedId = useId();
  const [uncontrolledId, setUncontrolledId] = useState<string | undefined>();
  const enabledTabs = tabs.filter((tab) => !tab.disabled);
  const selectedTab = tabs.find((tab) => tab.id === (selectedId ?? uncontrolledId) && !tab.disabled) ?? enabledTabs[0];

  if (!selectedTab) return null;

  const selectTab = (id: string) => {
    if (selectedId === undefined) setUncontrolledId(id);
    onSelectedIdChange?.(id);
  };
  const selectedIndex = enabledTabs.findIndex((tab) => tab.id === selectedTab.id);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const lastIndex = enabledTabs.length - 1;
    let targetIndex: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') targetIndex = (selectedIndex + 1) % enabledTabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') targetIndex = (selectedIndex - 1 + enabledTabs.length) % enabledTabs.length;
    if (event.key === 'Home') targetIndex = 0;
    if (event.key === 'End') targetIndex = lastIndex;
    if (targetIndex === undefined) return;

    event.preventDefault();
    const next = enabledTabs[targetIndex];
    if (!next) return;
    selectTab(next.id);
    document.getElementById(`${generatedId}-tab-${next.id}`)?.focus();
  };

  return (
    <div className="tabs">
      <div aria-label={label} className="tabs__list" role="tablist">
        {tabs.map((tab) => {
          const selected = tab.id === selectedTab.id;
          const tabId = `${generatedId}-tab-${tab.id}`;
          const panelId = `${generatedId}-panel-${tab.id}`;
          return (
            <button
              aria-controls={panelId}
              aria-selected={selected}
              className="tabs__tab"
              disabled={tab.disabled}
              id={tabId}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              onKeyDown={onKeyDown}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`${generatedId}-tab-${selectedTab.id}`}
        className="tabs__panel"
        id={`${generatedId}-panel-${selectedTab.id}`}
        role="tabpanel"
        tabIndex={0}
      >
        {selectedTab.content}
      </div>
    </div>
  );
}
