// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import Onboarding from '../../src/client/views/Onboarding';
vi.mock('../../src/client/lib/api', () => ({ api: { post: vi.fn() } }));
vi.mock('../../src/client/lib/entrySave', () => ({ saveEntry: vi.fn() }));
import { api } from '../../src/client/lib/api';
import { saveEntry } from '../../src/client/lib/entrySave';
beforeEach(() => { cleanup(); vi.resetAllMocks(); });

it('opens the practice without an entry or automatic generation', async () => {
  vi.mocked(api.post).mockResolvedValue({ ok: true });
  const done = vi.fn();
  render(<MemoryRouter><Onboarding user={{ uid: 'reader' } as User} onDone={done} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /open my practice/i }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(saveEntry).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledWith('/api/profile/onboard', expect.objectContaining({ weeklyLetters: false, welcomeLetters: false }));
});

it('offers reading first and retains an optional writing path', () => {
  render(<MemoryRouter><Onboarding user={{ uid: 'first-user' } as User} onDone={() => undefined} /></MemoryRouter>);
  expect(screen.getByRole('button', { name: /open my practice/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /begin/i }));
  expect(screen.getByText(/Step 2 of 2/)).toBeTruthy();
  expect(screen.getByText(/What happens next/)).toBeTruthy();
});

it('waits for the first entry to sync and explicitly opts out of automatic letters', async () => {
  let finishSave!: () => void;
  vi.mocked(saveEntry).mockReturnValue({ outcome: Promise.resolve('queued'), final: new Promise<void>((resolve) => { finishSave = resolve; }) });
  vi.mocked(api.post).mockResolvedValue({ ok: true });
  const onDone = vi.fn();
  render(<MemoryRouter><Onboarding user={{ uid: 'first-user' } as User} onDone={onDone} /></MemoryRouter>);
  fireEvent.click(screen.getByText('Optional Notebook reflection preferences'));
  expect(screen.getByRole('button', { name: 'Gentle' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: /begin/i }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Today was ordinary.' } });
  fireEvent.click(screen.getByRole('button', { name: /save entry and open/i }));
  await screen.findByText(/still syncing/);
  expect(api.post).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
  await act(async () => finishSave());
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledWith('/api/profile/onboard', expect.objectContaining({
    weeklyLetters: false, welcomeLetters: false,
    reflectionPreferences: { depth: 'gentle', interests: [], challenge: false, autoReflect: false },
  }));
});
