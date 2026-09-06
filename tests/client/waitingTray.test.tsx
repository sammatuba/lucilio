// @vitest-environment jsdom
// Ported from the old Desk tests: WaitingTray renders the same honest states
// (composing, undelivered, sealed) from fixture payloads, and renders nothing
// when there is truly nothing waiting or recent.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WaitingTray from '../../src/client/components/WaitingTray';
import type { DeskPayload } from '../../src/shared/schemas';

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

function mount(desk: DeskPayload | null) {
  return render(
    <MemoryRouter>
      <WaitingTray desk={desk} refresh={() => undefined} />
    </MemoryRouter>,
  );
}

describe('WaitingTray', () => {
  afterEach(() => cleanup());

  it('renders nothing when there is no desk yet', () => {
    const { container } = mount(null);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when nothing is composing, undelivered, sealed, or recent', () => {
    const { container } = mount(baseDesk());
    expect(container.firstChild).toBeNull();
  });

  it('composing welcome cycles say the first letters are being written', () => {
    mount(
      baseDesk({
        composing: [{ cycleId: 'welcome', kind: 'welcome', startedAt: new Date().toISOString() }],
      }),
    );
    expect(screen.getByText(/first letters are being written/i)).toBeTruthy();
  });

  it('undelivered letters are named in voice, with the ask-again note', () => {
    mount(
      baseDesk({
        undelivered: [
          { cycleId: 'req-director-2026-01-06', kind: 'requested', cid: 'director', at: new Date().toISOString() },
        ],
      }),
    );
    expect(screen.getByText(/did not come through/i)).toBeTruthy();
  });

  it('sealed letters render as a waiting envelope, heading reads "Waiting for you"', () => {
    mount(
      baseDesk({
        waitingLetters: [
          { id: 'l1', cid: 'director', status: 'sealed', createdAt: new Date().toISOString() } as never,
        ],
      }),
    );
    expect(screen.getByText('Waiting for you')).toBeTruthy();
    expect(screen.getByText('sealed')).toBeTruthy();
  });

  it('recent opened letters render when nothing is sealed, heading reads "Recent letters"', () => {
    mount(
      baseDesk({
        recentLetters: [
          { id: 'l2', cid: 'director', status: 'final', createdAt: new Date().toISOString() } as never,
        ],
      }),
    );
    expect(screen.getByText('Recent letters')).toBeTruthy();
    expect(screen.getByText('final')).toBeTruthy();
  });
});
