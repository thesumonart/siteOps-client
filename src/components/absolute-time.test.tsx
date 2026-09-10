import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AbsoluteTime } from './absolute-time';

/**
 * Assertions are timezone-agnostic on purpose: the point of the component is
 * that it formats in the *reader's* zone, so a test that pinned an expected
 * string would only be asserting the machine it ran on.
 */
describe('AbsoluteTime', () => {
  it('shows an absolute date and time rather than a relative phrase', () => {
    render(<AbsoluteTime iso="2026-06-15T14:03:22.000Z" />);

    const element = screen.getByText(/2026/);
    expect(element.tagName).toBe('TIME');
    expect(element.textContent).not.toMatch(/ago/);
    // Minutes and seconds, so checks seconds apart can be told apart.
    expect(element.textContent).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('keeps the raw timestamp machine-readable', () => {
    render(<AbsoluteTime iso="2026-06-15T14:03:22.000Z" />);
    expect(screen.getByText(/2026/)).toHaveAttribute('dateTime', '2026-06-15T14:03:22.000Z');
  });

  it('keeps the relative reading available in the tooltip', () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60_000).toISOString();
    render(<AbsoluteTime iso={threeMinutesAgo} />);

    expect(screen.getByTitle('3 minutes ago')).toBeInTheDocument();
  });

  it('says so instead of rendering a broken date', () => {
    render(<AbsoluteTime iso="not-a-date" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('accepts a class name', () => {
    render(<AbsoluteTime iso="2026-06-15T14:03:22.000Z" className="font-mono" />);
    expect(screen.getByText(/2026/)).toHaveClass('font-mono');
  });
});
