// @vitest-environment jsdom
// Production sign-in goes through a full-page redirect (the popup round-trip
// needs third-party storage between the app origin and the auth domain, which
// restrictive browsers block — seen live 2026-09-06). The Landing must resolve
// the redirect return through completeRedirectSignIn and surface failures via
// the shared copy map — never a raw Firebase code.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { signInWithGoogle } from '../../src/client/lib/auth';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../../src/client/views/Landing';

let redirectError: unknown = null;

vi.mock('../../src/client/lib/auth', () => ({
  onAuthStateChanged: () => () => undefined,
  signOut: vi.fn(async () => undefined),
  signInWithGoogle: vi.fn(async () => undefined),
  completeRedirectSignIn: vi.fn(async () => {
    if (redirectError) throw redirectError;
  }),
  devSignIn: vi.fn(),
  useEmulators: false,
}));

vi.mock('../../src/client/lib/firebase', () => ({
  db: {},
  auth: {},
  appCheck: null,
  googleProvider: {},
  useEmulators: false,
}));

describe('Landing (production redirect sign-in)', () => {
  beforeEach(() => {
    redirectError = null;
    vi.clearAllMocks();
    cleanup();
  });

  it('offers Google sign-in and no demo panel outside the emulator', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
    expect(screen.queryByText(/emulator mode/)).toBeNull();
  });

  it('resolves a redirect return with no pending result and shows no error', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.queryByText(/Sign-in did not complete/)).toBeNull();
    expect(screen.queryByText(/site data/)).toBeNull();
  });

  it('surfaces a redirect sign-in failure through the copy map', async () => {
    redirectError = new Error('Firebase: Error (auth/web-storage-unsupported).');
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(await screen.findByText(/Allow cookies and site data for this site/)).toBeTruthy();
  });

  it('explains the practice before offering sign-in', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByText(/Write and save/)).toBeTruthy();
    expect(screen.getByText(/reads only that entry/)).toBeTruthy();
    expect(screen.getByText(/Optional: ask a correspondent/)).toBeTruthy();
  });

  it('hands the click to the redirect sign-in', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    expect(signInWithGoogle).toHaveBeenCalled();
  });
});
