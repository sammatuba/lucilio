// @vitest-environment jsdom
// WP-4, first slice + M2-6: the onboarding guard must hold on every route —
// a new user cannot skip the welcome cycle by way of the nav. App is rendered
// whole with the auth, firebase, and api layers mocked; the desk payload is
// the only variable.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../src/client/App';
import type { DeskPayload } from '../../src/shared/schemas';

const fakeUser = { uid: 'u1', displayName: 'Tester' };
let deskPayload: DeskPayload | null = null;

vi.mock('../../src/client/lib/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(fakeUser);
    return () => undefined;
  },
  signOut: vi.fn(async () => undefined),
  signInWithGoogle: vi.fn(),
  completeRedirectSignIn: vi.fn(async () => undefined),
  devSignIn: vi.fn(),
  useEmulators: true,
}));
vi.mock('../../src/client/lib/firebase', () => ({
  db: {},
  auth: {},
  appCheck: null,
  googleProvider: {},
  useEmulators: true,
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => undefined),
}));
vi.mock('firebase/app-check', () => ({ getToken: vi.fn(async () => null) }));
vi.mock('../../src/client/lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
  api: {
    get: vi.fn(async (path: string) => {
      if (path.includes('/thread')) {
        return {
          correspondent: { cid: 'director', cardVersion: 1, status: 'active', activatedAt: new Date().toISOString() },
          letters: [],
        };
      }
      return deskPayload;
    }),
    post: vi.fn(async () => ({})),
    del: vi.fn(),
  },
  downloadExport: vi.fn(),
}));

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

describe('onboarding guard on every route (M2-6)', () => {
  beforeEach(() => {
    cleanup();
  });

  it.each(['/', '/notebook', '/desk', '/correspondents', '/atlas', '/atlas/liternum', '/trust', '/letter/abc'])(
    '%s leads back to onboarding before the practice begins',
    async (path) => {
      deskPayload = baseDesk({ profile: { tz: 'UTC', postDay: 'sunday', onboarded: false, crisisNotice: false } });
      render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      expect(await screen.findByText('The practice')).toBeTruthy();
    },
  );

  it('an onboarded user reaches their surfaces', async () => {
    deskPayload = baseDesk();
    render(
      <MemoryRouter initialEntries={['/notebook']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Notebook' })).toBeTruthy();
  });

  it('/desk redirects to /', async () => {
    deskPayload = baseDesk();
    render(
      <MemoryRouter initialEntries={['/desk']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Notebook' })).toBeTruthy();
  });

  it('/study redirects to /correspondents', async () => {
    deskPayload = baseDesk();
    render(
      <MemoryRouter initialEntries={['/study']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Correspondents' })).toBeTruthy();
  });

  it('/study/:cid redirects to /correspondents/:cid', async () => {
    deskPayload = baseDesk();
    render(
      <MemoryRouter initialEntries={['/study/director']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('The Director')).toBeTruthy();
  });

  it('returning to /onboarding after onboarding leads back to the Notebook', async () => {
    deskPayload = baseDesk();
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Notebook' })).toBeTruthy();
  });
});

describe('account menu', () => {
  beforeEach(() => {
    cleanup();
  });

  it('opens on click, lists the account actions, and closes on Escape', async () => {
    deskPayload = baseDesk();
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    const trigger = await screen.findByRole('button', { name: /Tester/i });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = screen.getByRole('menu');
    expect(menu).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Settings/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Trust Center/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Export my data/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Sign out/i })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('About page', () => {
  it('is reachable without sign-in and inside the shell', async () => {
    const { default: About } = await import('../../src/client/views/About');
    const { MemoryRouter } = await import('react-router-dom');
    render(<MemoryRouter><About standalone /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'About Lucilio' })).toBeTruthy();
    expect(screen.getAllByText(/Seneca/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeTruthy();
  });
});
