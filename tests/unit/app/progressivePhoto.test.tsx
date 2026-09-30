// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProgressivePhoto } from '../../../src/app/components/ProgressivePhoto';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ProgressivePhoto', () => {
  it('uses a nearby published width at the current DPR instead of doubling the download', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(378);
    vi.stubGlobal('devicePixelRatio', 1.75);
    const { container } = render(<ProgressivePhoto alt="Portrait" height={853} width={1280} priority
      sizes="100vw" sources={[{ url: '/preview.webp', width: 320 }, { url: '/small.webp', width: 640 },
        { url: '/medium.webp', width: 1280 }, { url: '/large.webp', width: 2560 }]} />);
    expect(container.querySelector('img[srcset]')).toHaveAttribute('srcset', '/preview.webp 320w, /small.webp 640w');
  });

  it('keeps a larger variant when the smaller one would miss more than 5 percent of the target', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
    vi.stubGlobal('devicePixelRatio', 2);
    const { container } = render(<ProgressivePhoto alt="Portrait" height={853} width={1280} priority
      sizes="100vw" sources={[{ url: '/preview.webp', width: 320 }, { url: '/small.webp', width: 640 },
        { url: '/medium.webp', width: 1280 }]} />);
    expect(container.querySelector('img[srcset]')).toHaveAttribute('srcset', '/preview.webp 320w, /small.webp 640w, /medium.webp 1280w');
  });
  it('starts priority variants before the preview completes, only after owner sources resolve', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(412);
    const props = { alt: 'Portrait', height: 900, width: 600, priority: true, sizes: '100vw' };
    const { container, rerender } = render(<ProgressivePhoto {...props} enabled={false}
      sources={[{ url: '/default-preview.webp', width: 320 }, { url: '/default-large.webp', width: 1280 }]} />);
    expect(container.querySelector('img')).toBeNull();
    rerender(<ProgressivePhoto {...props}
      sources={[{ url: '/owner-preview.webp', width: 320 }, { url: '/owner-large.webp', width: 1280 }]} />);
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(container.querySelector('.progressive-photo__optimized')).toHaveAttribute('sizes', '412px');
    expect(container.innerHTML).not.toContain('/default-');
  });

  it('updates the responsive size when its frame changes without a window resize', () => {
    let frameWidth = 350;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => frameWidth);
    let resize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const { container, unmount } = render(<ProgressivePhoto alt="Card" height={600} width={900} priority
      sizes="100vw" sources={[{ url: '/preview.webp', width: 320 }, { url: '/large.webp', width: 1280 }]} />);
    expect(container.querySelector('img[srcset]')).toHaveAttribute('sizes', '350px');
    act(() => { vi.stubGlobal('devicePixelRatio', 3); window.dispatchEvent(new Event('resize')); });
    expect(container.querySelector('img[srcset]')).toHaveAttribute('srcset', '/preview.webp 320w, /large.webp 1280w');
    act(() => { frameWidth = 620; resize(); });
    expect(container.querySelector('img[srcset]')).toHaveAttribute('sizes', '620px');
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
  it('requests no source until owner settings resolve', () => {
    const { container, rerender } = render(<ProgressivePhoto alt="Portrait" enabled={false} height={900}
      immediate sizes="100vw" sources={[{ url: '/default.webp', width: 320 }]} width={600} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild).toHaveStyle({ aspectRatio: '600 / 900' });
    rerender(<ProgressivePhoto alt="Portrait" height={900} immediate sizes="100vw"
      sources={[{ url: '/owner.webp', width: 320 }]} width={600} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/owner.webp');
    expect(container.innerHTML).not.toContain('/default.webp');
  });

  it('keeps responsive selection and medium-quality caps after the preview loads', () => {
    const { container } = render(<ProgressivePhoto alt="Gallery" height={1200} immediate maxQuality="medium"
      sizes="50vw" sources={[{ url: '/full.webp', width: 2400 }, { url: '/preview.webp', width: 320 },
        { url: '/medium.webp', width: 1600 }]} width={1800} />);
    const preview = screen.getByRole('img');
    expect(preview).toHaveAttribute('src', '/preview.webp');
    expect(container.querySelectorAll('img')).toHaveLength(1);
    fireEvent.load(preview);
    const display = container.querySelector('.progressive-photo__optimized');
    expect(display).toHaveAttribute('srcset', '/preview.webp 320w, /medium.webp 1600w');
    expect(display).toHaveAttribute('sizes', '50vw');
    expect(container.innerHTML).not.toContain('/full.webp');
  });

  it('renders a static logo once with dimensions and containment', () => {
    const { container } = render(<ProgressivePhoto alt="Studio" fit="contain" height={256}
      immediate sizes="40px" src="/logo.png" width={256} />);
    const logo = screen.getByRole('img');
    fireEvent.load(logo);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(logo).not.toHaveAttribute('srcset');
    expect(logo).toHaveAttribute('height', '256');
    expect(container.firstElementChild).toHaveClass('progressive-photo--single', 'progressive-photo--contain', 'progressive-photo--ready');
  });

  it('keeps a local blob source without inventing variants or dimensions', () => {
    const { container, rerender } = render(<ProgressivePhoto alt="Local preview" immediate sizes="100vw" src="blob:local-first" />);
    fireEvent.load(screen.getByRole('img'));
    rerender(<ProgressivePhoto alt="Local preview" immediate sizes="100vw" src="blob:local-second" />);
    const preview = screen.getByRole('img');
    expect(preview).toHaveAttribute('src', 'blob:local-second');
    expect(preview).not.toHaveAttribute('width');
    expect(preview).not.toHaveAttribute('height');
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
