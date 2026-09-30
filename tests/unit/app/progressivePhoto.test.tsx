// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ProgressivePhoto } from '../../../src/app/components/ProgressivePhoto';

afterEach(cleanup);

describe('ProgressivePhoto', () => {
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
