// @vitest-environment jsdom
// Correspondents renamed from Study: three cards, the shared "ask to write"
// affordance from the Desk aside, and the demoted "More ▾ / End this
// correspondence" flow replacing the red Conclude button.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Correspondents from '../../src/client/views/Correspondents';
import type { DeskPayload } from '../../src/shared/schemas';

vi.mock('../../src/client/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  api: { get: vi.fn(), post: vi.fn(async () => ({})), del: vi.fn() },
  downloadExport: vi.fn(),
}));

import { api } from '../../src/client/lib/api';

function baseDesk(overrides: Partial<DeskPayload> = {}): DeskPayload {
  const now = new Date().toISOString();
  return {
    profile: { tz: 'UTC', postDay: 'sunday', onboarded: true, crisisNotice: false },
    correspondents: [
      { cid: 'director', cardVersion: 1, status: 'active', activatedAt: now },
      { cid: 'future_self', cardVersion: 1, status: 'active', activatedAt: now },
      { cid: 'foreign', cardVersion: 1, status: 'active', activatedAt: now },
    ],
    waitingLetters: [],
    recentLetters: [],
    composing: [],
    undelivered: [],
    nextPostDay: '2026-09-13',
    requestUsedToday: {},
    ...overrides,
  };
}

function threadFor(cid: string, status: 'active' | 'concluded' = 'active') {
  return {
    correspondent: { cid, cardVersion: 1, status, activatedAt: new Date().toISOString() },
    letters: [{}, {}],
  };
}

function mount(desk: DeskPayload) {
  return render(
    <MemoryRouter>
      <Correspondents desk={desk} refresh={() => undefined} />
    </MemoryRouter>,
  );
}

describe('Correspondents', () => {
  beforeEach(() => {
    cleanup();
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      const cid = path.split('/')[3] ?? '';
      return threadFor(cid);
    });
    vi.mocked(api.post).mockReset();
    vi.mocked(api.post).mockResolvedValue({});
  });

  it('renders three cards', async () => {
    mount(baseDesk());
    await waitFor(() => expect(screen.getAllByText(/letter/).length).toBeGreaterThan(0));
    expect(screen.getByText('The Director')).toBeTruthy();
    expect(screen.getByText('The Future Self')).toBeTruthy();
    expect(screen.getAllByText(/^\d+ letters?$/).length).toBe(3);
  });

  it('explains how a correspondence differs from a reflection', async () => {
    mount(baseDesk());
    expect(await screen.findByText(/A correspondence is optional and slower than a reflection/i)).toBeTruthy();
  });

  it('the ask button posts to /api/letters/request', async () => {
    mount(baseDesk());
    const button = await screen.findByRole('button', { name: /Ask The Director to write/i });
    fireEvent.click(button);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/letters/request', { cid: 'director' }));
  });

  it('shows asked-today disabled state', async () => {
    mount(baseDesk({ requestUsedToday: { director: true } }));
    const button = await screen.findByRole('button', { name: /The Director — asked today/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('More reveals End this correspondence, and the dialog shows the new copy', async () => {
    mount(baseDesk());
    const moreButtons = await screen.findAllByRole('button', { name: /More/ });
    const first = moreButtons[0];
    if (!first) throw new Error('no More button found');
    fireEvent.click(first);
    const endButton = await screen.findByRole('button', { name: /End this correspondence/i });
    fireEvent.click(endButton);
    expect(
      await screen.findByText(
        /will write one final letter, and this volume becomes read-only\. Your Notebook reflections and your other correspondents are not affected\./,
      ),
    ).toBeTruthy();
  });
});
