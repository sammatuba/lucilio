// @vitest-environment jsdom
// WP-4, first slice: the composer is the only layer that carries the
// never-lose-input invariant (§2.8), and until now it was the only untested
// layer. These tests pin the M1-6 contract: the composer never clears before
// the write is acknowledged; a slow ack degrades to the truthful queued note
// while the words stay; a failure keeps the words and offers Retry Save.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import Notebook from '../../src/client/views/Notebook';

type SnapshotNext = (snap: {
  docs: { data: () => unknown }[];
  metadata: { hasPendingWrites: boolean };
}) => void;
let snapshotNext: SnapshotNext = () => undefined;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn((_q: unknown, next: SnapshotNext) => {
    snapshotNext = next;
    return () => undefined;
  }),
}));
vi.mock('../../src/client/lib/firebase', () => ({
  db: {},
  auth: {},
  appCheck: null,
  googleProvider: {},
  useEmulators: true,
}));
vi.mock('firebase/app-check', () => ({ getToken: vi.fn(async () => null) }));
vi.mock('../../src/client/lib/entrySave', () => ({ saveEntry: vi.fn() }));
vi.mock('../../src/client/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
import { api } from '../../src/client/lib/api';
import { DEFAULT_REFLECTION_PREFERENCES } from '../../src/shared/schemas';
import { setNotebookDraft } from '../../src/client/lib/notebookDraft';
import { setPlateSeed } from '../../src/client/lib/plateSeed';

import { saveEntry } from '../../src/client/lib/entrySave';
const saveEntryMock = vi.mocked(saveEntry);

const user = { uid: 'u1', displayName: 'Tester' } as unknown as User;

beforeEach(() => {
  cleanup();
  saveEntryMock.mockReset();
  vi.mocked(api.get).mockResolvedValue({ preferences: DEFAULT_REFLECTION_PREFERENCES, weeklyLetters: false });
  vi.mocked(api.post).mockReset();
  snapshotNext = () => undefined;
  setNotebookDraft(user.uid, '');
});

const baseDesk = {
  profile: { tz: 'UTC', postDay: 'sunday', onboarded: true, crisisNotice: false },
  correspondents: [
    { cid: 'director', cardVersion: 1, status: 'active', activatedAt: new Date().toISOString() },
    { cid: 'future_self', cardVersion: 1, status: 'active', activatedAt: new Date().toISOString() },
    { cid: 'foreign', cardVersion: 1, status: 'active', activatedAt: new Date().toISOString() },
  ],
  waitingLetters: [],
  recentLetters: [],
  composing: [],
  undelivered: [],
  nextPostDay: '2026-09-13',
  requestUsedToday: {},
} as const;

function mount() {
  render(
    <MemoryRouter>
      <Notebook user={user} desk={baseDesk as never} refresh={() => undefined} />
    </MemoryRouter>,
  );
  act(() => {
    snapshotNext({ docs: [], metadata: { hasPendingWrites: false } });
  });
}

function type(text: string) {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
}

function value(): string {
  return (screen.getByRole('textbox') as HTMLTextAreaElement).value;
}

describe('Notebook composer integrity (§2.8, M1-6)', () => {
  it('keeps saving available and exposes a retry when preferences cannot load', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('preferences unavailable'))
      .mockResolvedValueOnce({ preferences: DEFAULT_REFLECTION_PREFERENCES, weeklyLetters: false });
    mount();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/saving entries is still available/i);
    type('This can still be saved.');
    expect((screen.getByRole('button', { name: /save entry/i }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /retry preferences/i }));
    await screen.findByText('Remember preferences');
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('automatic reflection waits for a confirmed save and uses the saved preference', async () => {
    let resolveFinal!: () => void;
    vi.mocked(api.get).mockResolvedValueOnce({ preferences: { ...DEFAULT_REFLECTION_PREFERENCES, autoReflect: true }, weeklyLetters: false });
    vi.mocked(api.get).mockResolvedValue({ bodyMd: 'A gentle reflection.', groundingRefs: [] });
    vi.mocked(api.post).mockResolvedValue({ state: 'delivered', letterId: 'reflection-1' });
    saveEntryMock.mockReturnValue({ entryId: 'entry-1', outcome: Promise.resolve('queued'), final: new Promise<void>((resolve) => { resolveFinal = resolve; }) });
    mount();
    await waitFor(() => expect(screen.getByText('Remember preferences')).toBeTruthy());
    type('An ordinary afternoon.');
    fireEvent.click(screen.getByRole('button', { name: /save entry/i }));
    act(() => snapshotNext({ docs: [{ data: () => ({ id: 'entry-1', bodyMd: 'An ordinary afternoon.', createdAt: new Date().toISOString() }) }], metadata: { hasPendingWrites: true } }));
    await screen.findByText(/Still sending/);
    expect(api.post).not.toHaveBeenCalled();
    await act(async () => resolveFinal());
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/reflections', {
      entryId: 'entry-1', preferences: { ...DEFAULT_REFLECTION_PREFERENCES, autoReflect: true },
    }));
  });
  it('never clears the composer before the write is acknowledged', async () => {
    let resolve!: (v: 'saved' | 'queued') => void;
    saveEntryMock.mockReturnValue({
      outcome: new Promise<'saved' | 'queued'>((res) => {
        resolve = res;
      }),
      final: Promise.resolve(),
    });
    mount();
    type('Walked in the rain.');
    fireEvent.click(screen.getByRole('button', { name: /save entry/i }));

    expect(value()).toBe('Walked in the rain.');
    await act(async () => {
      resolve('saved');
    });
    expect(value()).toBe('');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('preserves words typed while the save is in flight', async () => {
    let resolve!: (v: 'saved' | 'queued') => void;
    saveEntryMock.mockReturnValue({
      outcome: new Promise<'saved' | 'queued'>((res) => { resolve = res; }),
      final: Promise.resolve(),
    });
    mount();
    type('Original words.');
    fireEvent.click(screen.getByRole('button', { name: /save entry/i }));
    type('Original words. Then I kept writing.');

    await act(async () => resolve('saved'));
    expect(value()).toBe('Original words. Then I kept writing.');
  });

  it('a slow ack announces the queued state truthfully, then clears when the write lands', async () => {
    let resolveFinal!: () => void;
    saveEntryMock.mockReturnValue({
      outcome: Promise.resolve('queued'),
      final: new Promise<void>((res) => {
        resolveFinal = res;
      }),
    });
    mount();
    type('Kept on this device.');
    fireEvent.click(screen.getByRole('button', { name: /save entry/i }));

    const note = await screen.findByRole('status');
    expect(note.textContent).toMatch(/kept on this device/i);
    expect(value()).toBe('Kept on this device.');

    await act(async () => {
      resolveFinal();
    });
    await waitFor(() => expect(value()).toBe(''));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('does not allow a queued write to be submitted a second time', async () => {
    let resolveFinal!: () => void;
    saveEntryMock.mockReturnValue({
      outcome: Promise.resolve('queued'),
      final: new Promise<void>((res) => { resolveFinal = res; }),
    });
    mount();
    type('One submission only.');
    fireEvent.click(screen.getByRole('button', { name: /save entry/i }));
    await screen.findByText(/Still sending/);
    expect((screen.getByRole('button', { name: /waiting to sync/i }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /waiting to sync/i }));
    expect(saveEntryMock).toHaveBeenCalledTimes(1);
    await act(async () => resolveFinal());
  });

  it('keeps a draft when the Notebook view is unmounted and mounted again', async () => {
    const first = render(
      <MemoryRouter>
        <Notebook user={user} desk={baseDesk as never} refresh={() => undefined} />
      </MemoryRouter>,
    );
    act(() => snapshotNext({ docs: [], metadata: { hasPendingWrites: false } }));
    type('A draft between routes.');
    first.unmount();

    mount();
    expect(value()).toBe('A draft between routes.');
  });

  it('asks before combining an Atlas handoff with an existing draft', async () => {
    setNotebookDraft(user.uid, 'Words already in progress.');
    setPlateSeed({ plate: 'Plate I', title: 'A place to remember', quote: 'A line from the Atlas.' });
    mount();

    await screen.findByText(/already a draft here/i);
    expect(value()).toBe('Words already in progress.');
    expect(screen.getByRole('button', { name: /append to draft/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /replace draft/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /append to draft/i }));
    expect(value()).toContain('Words already in progress.');
    expect(value()).toContain('A line from the Atlas.');
  });

  it('a failed write keeps the words and Retry Save succeeds', async () => {
    const responses = [
      {
        outcome: Promise.reject(new Error('client is offline')),
        final: Promise.resolve(),
      },
      { outcome: Promise.resolve('saved' as const), final: Promise.resolve() },
    ];
    saveEntryMock.mockImplementation(() => responses.shift()!);
    mount();
    type('Lost? Never.');
    fireEvent.click(screen.getByRole('button', { name: /save entry/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/offline/i);
    expect(value()).toBe('Lost? Never.');

    fireEvent.click(screen.getByRole('button', { name: /retry save/i }));
    expect(saveEntryMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(value()).toBe(''));
  });
});

describe('Notebook as the home surface (one coherent home)', () => {
  it('shows the composer and the correspondents aside with all three correspondents and a link to the Atlas', async () => {
    mount();
    await waitFor(() => expect(screen.getByText('Remember preferences')).toBeTruthy());

    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('button', { name: /save entry/i })).toBeTruthy();

    expect(screen.getByText('Your correspondents')).toBeTruthy();
    expect(screen.getByText('The Director')).toBeTruthy();
    expect(screen.getByText('The Future Self')).toBeTruthy();
    expect(screen.getByRole('link', { name: /all correspondents/i })).toBeTruthy();

    expect(screen.getByText('Explore the Atlas')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open the atlas/i })).toBeTruthy();
  });
});
