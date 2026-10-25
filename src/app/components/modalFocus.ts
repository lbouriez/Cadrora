const FOCUSABLE = 'button, input, select, textarea, [href], [tabindex]';

export function modalTabStops(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[inert], [hidden]')) return false;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open
        && !ancestor.querySelector('summary')?.contains(element)) return false;
    }
    return true;
  });
}

interface ModalLayer { dialog: HTMLElement; backdrop: HTMLElement }
const layers: ModalLayer[] = [];
const originalInert = new Map<HTMLElement, boolean>();
let originalOverflow = '';
let observer: MutationObserver | undefined;

function syncLayers() {
  const top = layers.at(-1);
  if (!top) return;
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (!originalInert.has(child)) originalInert.set(child, child.hasAttribute('inert'));
    child.toggleAttribute('inert', child !== top.backdrop || originalInert.get(child) === true);
  }
}

export function isTopModal(dialog: HTMLElement) {
  return layers.at(-1)?.dialog === dialog;
}

/** A shared stack keeps the document locked until the final (possibly nested) modal closes. */
export function registerModal(dialog: HTMLElement, backdrop: HTMLElement) {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const layer = { dialog, backdrop };
  if (!layers.length) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    observer = new MutationObserver(syncLayers);
    observer.observe(document.body, { childList: true });
  }
  layers.push(layer);
  syncLayers();
  (modalTabStops(dialog)[0] ?? dialog).focus();

  return () => {
    const wasTop = isTopModal(dialog);
    const index = layers.indexOf(layer);
    if (index !== -1) layers.splice(index, 1);
    if (layers.length) syncLayers();
    else {
      observer?.disconnect();
      observer = undefined;
      for (const [element, inert] of originalInert) element.toggleAttribute('inert', inert);
      originalInert.clear();
      document.body.style.overflow = originalOverflow;
    }
    if (!wasTop) return;
    if (previous?.isConnected && !previous.closest('[inert]')) previous.focus();
    else {
      const remaining = layers.at(-1)?.dialog;
      if (remaining) (modalTabStops(remaining)[0] ?? remaining).focus();
    }
  };
}
