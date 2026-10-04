// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProgressivePhoto } from '../../../src/app/components/ProgressivePhoto';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ProgressivePhoto', () => {
  it('does not measure static images or one-variant photos', () => {
    const measured = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get');
    const resizeObserver = vi.fn();
    vi.stubGlobal('ResizeObserver', resizeObserver);
    const { container } = render(<>
      <ProgressivePhoto alt="Logo" immediate sizes="40px" src="/logo.svg" />
      <ProgressivePhoto alt="One variant" immediate height={600} width={900} sizes="100vw"
        sources={[{ url: '/only.webp', width: 900 }]} />
    </>);
    expect(measured).not.toHaveBeenCalled();
    expect(resizeObserver).not.toHaveBeenCalled();
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(container.querySelector('img[srcset]')).toBeNull();
  });

  it('prepares offscreen photos with the current size and DPR only when approaching the viewport', () => {
    let frameWidth = 350;
    const measured = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => frameWidth);
    const observeResize = vi.fn();
    vi.stubGlobal('ResizeObserver', class { observe = observeResize; disconnect() {} });
    let approach: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: typeof approach) { approach = callback; }
      observe() {}
      disconnect() {}
    });
    const { container } = render(<ProgressivePhoto alt="Offscreen card" height={600} width={900} lazyPreview
      sizes="100vw" sources={[{ url: '/preview.webp', width: 320 }, { url: '/small.webp', width: 640 },
        { url: '/medium.webp', width: 1280 }]} />);
    act(() => { frameWidth = 500; vi.stubGlobal('devicePixelRatio', 2); window.dispatchEvent(new Event('resize')); });
    expect(measured).not.toHaveBeenCalled();
    expect(observeResize).not.toHaveBeenCalled();
    expect(container.querySelector('img')).toBeNull();
    act(() => approach([{ isIntersecting: true }]));
    expect(observeResize).toHaveBeenCalledOnce();
    fireEvent.load(screen.getByRole('img'));
    expect(container.querySelector('img[srcset]')).toHaveAttribute('sizes', '500px');
    expect(container.querySelector('img[srcset]')).toHaveAttribute('srcset', '/preview.webp 320w, /small.webp 640w, /medium.webp 1280w');
  });

  it('settles an already-complete priority image without waiting for another load event', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'currentSrc', 'get').mockImplementation(function (this: HTMLImageElement) { return this.src; });
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1280);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const onVisualReady = vi.fn();
    const { container } = render(<ProgressivePhoto alt="Owner hero" height={853} width={1280} priority
      onVisualReady={onVisualReady} visualReadyAt="display" sizes="42vw"
      sources={[{ url: '/owner-preview.webp', width: 320 }, { url: '/owner-display.webp', width: 1280 }]} />);
    await waitFor(() => expect(onVisualReady).toHaveBeenCalledOnce());
    expect(container.firstElementChild).toHaveClass('progressive-photo--ready');
    expect(container.querySelector('img[srcset]')).toHaveAttribute('sizes', '800px');
  });

  it('releases the startup frame if both sources have already failed', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'currentSrc', 'get').mockImplementation(function (this: HTMLImageElement) { return this.src; });
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const onVisualReady = vi.fn();
    render(<ProgressivePhoto alt="Owner hero" height={853} width={1280} priority
      onVisualReady={onVisualReady} visualReadyAt="display" sizes="42vw"
      sources={[{ url: '/failed-preview.webp', width: 320 }, { url: '/failed-display.webp', width: 1280 }]} />);
    await waitFor(() => expect(onVisualReady).toHaveBeenCalledOnce());
  });

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

  it('reports a hero photo once after its first image decodes', async () => {
    const onVisualReady = vi.fn();
    const { container } = render(<ProgressivePhoto alt="Hero" height={853} width={1280} priority
      onVisualReady={onVisualReady} sizes="100vw"
      sources={[{ url: '/preview.webp', width: 320 }, { url: '/large.webp', width: 1280 }]} />);
    const preview = screen.getByRole('img');
    Object.defineProperty(preview, 'decode', { value: () => Promise.resolve() });
    fireEvent.load(preview);
    expect(onVisualReady).not.toHaveBeenCalled();
    await waitFor(() => expect(onVisualReady).toHaveBeenCalledOnce());
    fireEvent.load(container.querySelector('.progressive-photo__optimized') as HTMLImageElement);
    expect(onVisualReady).toHaveBeenCalledOnce();
  });

  it('releases hero copy after both variants fail', () => {
    const onVisualReady = vi.fn();
    const { container } = render(<ProgressivePhoto alt="Hero" height={853} width={1280} priority
      onVisualReady={onVisualReady} sizes="100vw"
      sources={[{ url: '/preview.webp', width: 320 }, { url: '/large.webp', width: 1280 }]} />);
    fireEvent.error(screen.getByRole('img'));
    expect(onVisualReady).not.toHaveBeenCalled();
    fireEvent.error(container.querySelector('.progressive-photo__optimized') as HTMLImageElement);
    expect(onVisualReady).toHaveBeenCalledOnce();
  });

  it('can hold the first frame until the display image has decoded, even with a ready preview', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const onVisualReady = vi.fn();
    let finishDecode = () => {};
    const decoding = new Promise<void>((resolve) => { finishDecode = resolve; });
    const { container } = render(<ProgressivePhoto alt="Hero" height={853} width={1280} priority
      onVisualReady={onVisualReady} visualReadyAt="display" sizes="100vw"
      sources={[{ url: '/preview.webp', width: 320 }, { url: '/large.webp', width: 1280 }]} />);
    const preview = screen.getByRole('img');
    Object.defineProperty(preview, 'decode', { value: () => Promise.resolve() });
    await act(() => { fireEvent.load(preview); return Promise.resolve(); });
    expect(onVisualReady).not.toHaveBeenCalled();
    const display = container.querySelector('.progressive-photo__optimized') as HTMLImageElement;
    Object.defineProperty(display, 'decode', { value: () => decoding });
    fireEvent.load(display);
    expect(onVisualReady).not.toHaveBeenCalled();
    await act(() => { finishDecode(); return decoding; });
    expect(onVisualReady).toHaveBeenCalledOnce();
  });

  it.each(['preview-first', 'display-fails-first'])('falls back to a decoded preview when the display image fails: %s', async (order) => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const onVisualReady = vi.fn();
    const { container } = render(<ProgressivePhoto alt="Hero" height={853} width={1280} priority
      onVisualReady={onVisualReady} visualReadyAt="display" sizes="100vw"
      sources={[{ url: '/preview.webp', width: 320 }, { url: '/large.webp', width: 1280 }]} />);
    const preview = screen.getByRole('img');
    const display = container.querySelector('.progressive-photo__optimized') as HTMLImageElement;
    Object.defineProperty(preview, 'decode', { value: () => Promise.resolve() });
    if (order === 'display-fails-first') fireEvent.error(display);
    await act(() => { fireEvent.load(preview); return Promise.resolve(); });
    if (order === 'preview-first') {
      expect(onVisualReady).not.toHaveBeenCalled();
      fireEvent.error(display);
    }
    expect(onVisualReady).toHaveBeenCalledOnce();
    expect(container.firstElementChild).not.toHaveClass('progressive-photo--ready');
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
