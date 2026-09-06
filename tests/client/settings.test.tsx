// @vitest-environment jsdom
// Settings: display name prefilled from the desk profile (falling back to the
// Google name), Save posts displayName, email is read-only, and delete
// requires typing "delete" before it can be confirmed.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { User } from 'firebase/auth';
import Settings from '../../src/client/views/Settings';
import { DEFAULT_REFLECTION_PREFERENCES } from '../../src/shared/schemas';

vi.mock('../../src/client/lib/firebase', () => ({
  db: {},
  auth: {},
  appCheck: null,
  googleProvider: {},
  useEmulators: true,
}));
vi.mock('../../src/client/lib/auth', () => ({ signOut: vi.fn(async () => undefined) }));
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
import { api } from '../../src/client/lib/api';

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
  cleanup();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.del).mockReset();
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
  });
});
