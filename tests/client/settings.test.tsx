// @vitest-environment jsdom
// Settings: display name prefilled from the desk profile (falling back to the
// Google name), Save posts displayName, email is read-only, and delete
// requires typing "delete" before it can be confirmed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { signOut as fbSignOut, type User } from 'firebase/auth';
import Settings from '../../src/client/views/Settings';
import { auth } from '../../src/client/lib/firebase';
import { freshInquiryDraft, readInquiryDraft, writeInquiryDraft } from '../../src/client/lib/inquiryDraft';
import { getNotebookDraft, setNotebookDraft } from '../../src/client/lib/notebookDraft';
import { DEFAULT_REFLECTION_PREFERENCES } from '../../src/shared/schemas';

const mockAuth = vi.hoisted(() => ({ currentUser: null as User | null }));
vi.mock('../../src/client/lib/firebase', () => ({
  db: {},
  auth: mockAuth,
  appCheck: null,
  googleProvider: {},
  useEmulators: true,
}));
vi.mock('firebase/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/auth')>(), signOut: vi.fn(),
}));
vi.mock('../../src/client/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  api: { get: vi.fn(), post: vi.fn(), del: vi.fn() },
  downloadExport: vi.fn(),
}));
import { api, downloadExport } from '../../src/client/lib/api';

const user = { uid: 'u1', displayName: 'Google Name', email: 'user@example.com' } as unknown as User;

function baseDesk(displayName?: string) {
  return {
    profile: { tz: 'UTC', postDay: 'sunday', onboarded: true, crisisNotice: false, displayName },
    correspondents: [],
    waitingLetters: [],
    recentLetters: [],
    composing: [],
    undelivered: [],
    nextPostDay: '2026-09-13',
    requestUsedToday: {},
  };
}

beforeEach(() => {
  localStorage.clear();
  setNotebookDraft(user.uid, '');
  setNotebookDraft('other-user', '');
  mockAuth.currentUser = user;
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.del).mockReset();
  vi.mocked(downloadExport).mockReset();
  vi.mocked(fbSignOut).mockReset().mockImplementation(async () => { mockAuth.currentUser = null; });
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

async function mount(displayName?: string) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/api/desk') return baseDesk(displayName);
    if (path === '/api/reflection-preferences') return { preferences: DEFAULT_REFLECTION_PREFERENCES, weeklyLetters: false };
    throw new Error(`unexpected path ${path}`);
  });
  render(<Settings user={user} />);
  await screen.findByDisplayValue(displayName ?? 'Google Name');
}

describe('Settings', () => {
  it('prefills the display name from the desk profile', async () => {
    await mount('Saved Name');
    expect((screen.getByLabelText(/display name/i) as HTMLInputElement).value).toBe('Saved Name');
  });

  it('falls back to the Google display name when the profile has none', async () => {
    await mount(undefined);
    expect((screen.getByLabelText(/display name/i) as HTMLInputElement).value).toBe('Google Name');
  });

  it('saves the display name via POST /api/profile', async () => {
    vi.mocked(api.post).mockResolvedValue({ ok: true });
    await mount('Saved Name');
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/profile', { displayName: 'New Name' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/saved/i));
  });

  it('shows a failure note when saving the name fails', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('boom'));
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await screen.findByText(/not saved|try again/i);
  });

  it('reports an export failure without changing any account data', async () => {
    vi.mocked(downloadExport).mockRejectedValue(new Error('storage unavailable'));
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: 'Export my data' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('export could not be completed'));
    expect(api.del).not.toHaveBeenCalled();
  });

  it('renders the email read-only with the account-change note', async () => {
    await mount('Saved Name');
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('user@example.com');
    expect(emailInput.readOnly).toBe(true);
    expect(screen.getByText(/comes from your google account/i)).toBeTruthy();
  });

  it('disables the delete confirmation until "delete" is typed', async () => {
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    const confirmButton = screen.getByRole('button', { name: /delete everything/i }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    const typed = screen.getByLabelText(/type/i);
    fireEvent.change(typed, { target: { value: 'nope' } });
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(typed, { target: { value: 'delete' } });
    expect(confirmButton.disabled).toBe(false);
  });

  it('calls DELETE /api/account once confirmed', async () => {
    vi.mocked(api.del).mockResolvedValue(undefined);
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'delete' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete everything/i }));
    });
    expect(api.del).toHaveBeenCalledWith('/api/account');
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('keeps drafts until deletion succeeds, then clears them without asking for consent again', async () => {
    const draft = { ...freshInquiryDraft(), bodyMd: 'Still unsaved' };
    writeInquiryDraft(user.uid, 'q1', draft);
    writeInquiryDraft('other-user', 'q1', draft);
    let finishDelete!: () => void;
    vi.mocked(api.del).mockReturnValue(new Promise<void>((resolve) => { finishDelete = resolve; }));
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByText(/unsaved drafts on this device will also be discarded/i)).toBeTruthy();
    expect(readInquiryDraft(user.uid, 'q1')).toEqual(draft);
    fireEvent.click(screen.getByRole('button', { name: /keep my words/i }));
    expect(api.del).not.toHaveBeenCalled();
    expect(readInquiryDraft(user.uid, 'q1')).toEqual(draft);

    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: /delete everything/i }));
    expect(readInquiryDraft(user.uid, 'q1')).toEqual(draft);
    expect(fbSignOut).not.toHaveBeenCalled();
    await act(async () => { finishDelete(); });

    expect(readInquiryDraft(user.uid, 'q1')).toBeNull();
    expect(readInquiryDraft('other-user', 'q1')).toEqual(draft);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
    expect(screen.queryByText('Delete everything?')).toBeNull();
  });

  it.each([false, true])('cleans only the deleted account after a new sign-in and warns if cleanup fails (failure: %s)', async (cleanupFails) => {
    const otherUser = { uid: 'other-user' } as User;
    const ownDraft = { ...freshInquiryDraft(), bodyMd: 'The deleted account’s private draft' };
    const otherDraft = { ...freshInquiryDraft(), bodyMd: 'The new account’s private draft' };
    writeInquiryDraft(user.uid, 'q1', ownDraft);
    writeInquiryDraft(otherUser.uid, 'q1', otherDraft);
    setNotebookDraft(user.uid, 'Discard the deleted account’s Notebook');
    setNotebookDraft(otherUser.uid, 'Keep the new account’s Notebook');
    let finishDelete!: () => void;
    vi.mocked(api.del).mockReturnValue(new Promise<void>((resolve) => { finishDelete = resolve; }));
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: /delete everything/i }));
    expect(readInquiryDraft(user.uid, 'q1')).toEqual(ownDraft);
    expect(getNotebookDraft(user.uid)).toBe('Discard the deleted account’s Notebook');
    mockAuth.currentUser = otherUser;
    if (cleanupFails) vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage blocked'); });
    await act(async () => { finishDelete(); });

    expect(api.del).toHaveBeenCalledExactlyOnceWith('/api/account');
    expect(readInquiryDraft(user.uid, 'q1')).toEqual(cleanupFails ? ownDraft : null);
    expect(getNotebookDraft(user.uid)).toBe('');
    expect(fbSignOut).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(readInquiryDraft(otherUser.uid, 'q1')).toEqual(otherDraft);
    expect(getNotebookDraft(otherUser.uid)).toBe('Keep the new account’s Notebook');
    expect(auth.currentUser).toBe(otherUser);
    if (cleanupFails) {
      expect(window.alert).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/could not be cleared.*may remain.*browser settings/s));
      expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining('You will still be signed out'));
    } else {
      expect(window.alert).not.toHaveBeenCalled();
    }
    expect(screen.queryByText('Delete everything?')).toBeNull();
    expect(screen.queryByText(/erasure did not complete|signing out of this device did not finish/i)).toBeNull();
  });

  it('warns about uncleared local drafts but still signs out after successful deletion', async () => {
    const draft = { ...freshInquiryDraft(), bodyMd: 'Local words' };
    writeInquiryDraft(user.uid, 'q1', draft);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage blocked'); });
    vi.mocked(api.del).mockResolvedValue(undefined);
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'delete' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /delete everything/i })); });

    expect(api.del).toHaveBeenCalledExactlyOnceWith('/api/account');
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/could not be cleared.*may remain.*browser settings/s));
    expect(readInquiryDraft(user.uid, 'q1')).toEqual(draft);
    expect(screen.queryByText(/erasure did not complete|nothing is half-deleted/i)).toBeNull();
  });

  it('does not inspect malformed drafts or request redundant confirmation after deletion', async () => {
    localStorage.setItem('lucilio-inquiry-draft:u1:q1', '{not json');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('reading blocked'); });
    vi.mocked(api.del).mockResolvedValue(undefined);
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'delete' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /delete everything/i })); });

    expect(localStorage.length).toBe(0);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
  });

  it('keeps drafts and authentication when server deletion fails', async () => {
    const draft = { ...freshInquiryDraft(), bodyMd: 'Keep these words' };
    writeInquiryDraft(user.uid, 'q1', draft);
    vi.mocked(api.del).mockRejectedValue(new Error('server unavailable'));
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: /delete everything/i }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('erasure did not complete'));
    expect(fbSignOut).not.toHaveBeenCalled();
    expect(readInquiryDraft(user.uid, 'q1')).toEqual(draft);
    expect(auth.currentUser).toBe(user);
  });

  it('reports a post-delete sign-out failure without pretending server deletion failed', async () => {
    vi.mocked(api.del).mockResolvedValue(undefined);
    vi.mocked(fbSignOut).mockRejectedValue(new Error('Firebase unavailable'));
    await mount('Saved Name');
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'delete' } });
    fireEvent.click(screen.getByRole('button', { name: /delete everything/i }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Your account was deleted, but signing out'));
    expect(screen.queryByText(/erasure did not complete|nothing is half-deleted/i)).toBeNull();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(api.del).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: /delete account/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
