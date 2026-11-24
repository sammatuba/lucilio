// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import Onboarding from '../../src/client/views/Onboarding';
const auth = vi.hoisted(() => ({ currentUser: { uid: 'first-user' } as User }));
vi.mock('../../src/client/lib/firebase', () => ({ auth }));
vi.mock('../../src/client/lib/api', () => ({ api: { post: vi.fn() } }));
vi.mock('../../src/client/lib/entrySave', () => ({ saveEntry: vi.fn(), confirmEntry: vi.fn() }));
import { api } from '../../src/client/lib/api';
import { clearReceipt, readReceipt } from '../../src/client/lib/onboardingReceipt';
import { confirmEntry, saveEntry } from '../../src/client/lib/entrySave';
beforeEach(() => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, run: () => unknown) => Promise.resolve(run()) } }); cleanup(); localStorage.clear(); vi.resetAllMocks(); auth.currentUser = { uid: 'first-user' } as User; });

it('opens the practice without an entry or automatic generation', async () => {
  vi.mocked(api.post).mockResolvedValue({ ok: true });
  const done = vi.fn();
  render(<MemoryRouter><Onboarding user={auth.currentUser} onDone={done} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /open my practice/i }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(saveEntry).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledWith('/api/profile/onboard', expect.objectContaining({ weeklyLetters: false, welcomeLetters: false }));
});

it('offers reading first and retains an optional writing path', () => {
  render(<MemoryRouter><Onboarding user={auth.currentUser} onDone={() => undefined} /></MemoryRouter>);
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
  render(<MemoryRouter><Onboarding user={auth.currentUser} onDone={onDone} /></MemoryRouter>);
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

function openForm(done = vi.fn()) {
  return render(<MemoryRouter><Onboarding user={auth.currentUser} onDone={done} /></MemoryRouter>);
}
function submitEntry() {
  fireEvent.click(screen.getByRole('button', { name: /begin with writing/i }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Private first entry.' } });
  fireEvent.click(screen.getByRole('button', { name: /save entry and open/i }));
}

it('retains a body-free save receipt across a failed profile request and reload', async () => {
  vi.mocked(saveEntry).mockReturnValue({ outcome: Promise.resolve('saved'), final: Promise.resolve() });
  vi.mocked(api.post).mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({});
  const owner = auth.currentUser;
  const view = openForm();
  submitEntry();
  await screen.findByRole('alert');
  expect(readReceipt(owner.uid)?.status).toBe('saved');
  expect(JSON.stringify(localStorage)).not.toContain('Private first entry');
  view.unmount();

  auth.currentUser = { uid: 'someone-else' } as User;
  const other = openForm();
  expect(screen.queryByText('Your first entry is saved')).toBeNull();
  other.unmount();
  auth.currentUser = owner;
  const done = vi.fn();
  openForm(done);
  fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(saveEntry).toHaveBeenCalledOnce();
  expect(confirmEntry).not.toHaveBeenCalled();
  expect(readReceipt(owner.uid)).toBeNull();
});

it.each([true, false])('reconciles the exact pending entry after reload (exists = %s)', async (exists) => {
  let ack!: () => void;
  vi.mocked(saveEntry).mockReturnValue({ outcome: Promise.resolve('queued'), final: new Promise((resolve) => { ack = resolve; }) });
  vi.mocked(confirmEntry).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(exists);
  vi.mocked(api.post).mockResolvedValue({});
  const view = openForm();
  submitEntry();
  await screen.findByText(/still syncing/);
  const id = readReceipt(auth.currentUser.uid)!.entryId;
  expect(saveEntry).toHaveBeenCalledWith(auth.currentUser, 'Private first entry.', id);
  view.unmount();
  expect(readReceipt(auth.currentUser.uid)).toMatchObject({ status: 'pending', bodyMd: 'Private first entry.' });
  expect(api.post).not.toHaveBeenCalled();

  const done = vi.fn();
  openForm(done);
  fireEvent.click(screen.getByRole('button', { name: /check entry/i }));
  await screen.findByRole('alert');
  expect(readReceipt(auth.currentUser.uid)?.status).toBe('pending');
  fireEvent.click(screen.getByRole('button', { name: /check entry/i }));
  if (exists) await waitFor(() => expect(done).toHaveBeenCalledOnce());
  else {
    expect((await screen.findByRole('textbox') as HTMLTextAreaElement).value).toBe('Private first entry.');
    expect(readReceipt(auth.currentUser.uid)).toMatchObject({ status: 'draft', bodyMd: 'Private first entry.' });
    expect(api.post).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
  }
  expect(confirmEntry).toHaveBeenCalledWith(auth.currentUser.uid, id);
  expect(saveEntry).toHaveBeenCalledOnce();
  if (!exists) {
    cleanup();
    openForm(done);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Private first entry.');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My recovered first entry.' } });
    vi.mocked(saveEntry).mockReturnValue({ outcome: Promise.resolve('saved'), final: Promise.resolve() });
    fireEvent.click(screen.getByRole('button', { name: /save entry and open/i }));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(saveEntry).toHaveBeenLastCalledWith(auth.currentUser, 'My recovered first entry.', id);
  }
  expect(readReceipt(auth.currentUser.uid)).toBeNull();
  await act(async () => ack());
  expect(readReceipt(auth.currentUser.uid)).toBeNull();
});

it('keeps the second editor’s text when another tab already saved its first entry', async () => {
  vi.mocked(saveEntry).mockReturnValue({ outcome: Promise.resolve('saved'), final: Promise.resolve() });
  vi.mocked(api.post).mockRejectedValueOnce(new Error('profile response lost')).mockResolvedValueOnce({});
  const first = within(openForm().container);
  const done = vi.fn();
  const second = within(openForm(done).container);
  for (const [tab, body] of [[first, 'First tab entry'], [second, 'Other unsaved words']] as const) {
    fireEvent.click(tab.getByRole('button', { name: /begin with writing/i }));
    fireEvent.change(tab.getByRole('textbox'), { target: { value: body } });
  }
  fireEvent.click(first.getByRole('button', { name: /save entry and open/i }));
  await first.findByRole('alert');
  fireEvent.click(second.getByRole('button', { name: /save entry and open/i }));
  await second.findByText(/Another tab started/);
  expect((second.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Other unsaved words');
  expect(second.getByRole('button', { name: 'Download this text' })).toBeTruthy();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(done).not.toHaveBeenCalled();
  fireEvent.click(second.getByRole('button', { name: /discard this editor/i }));
  fireEvent.click(second.getByRole('button', { name: /finish setup/i }));
  await waitFor(() => expect(done).toHaveBeenCalledOnce());
  expect(saveEntry).toHaveBeenCalledOnce();
});

it('ignores an old write acknowledgement after the account signs out and discards its receipt', async () => {
  let ack!: () => void;
  vi.mocked(saveEntry).mockReturnValue({ outcome: Promise.resolve('queued'), final: new Promise((resolve) => { ack = resolve; }) });
  const first = auth.currentUser;
  const view = openForm();
  submitEntry();
  await screen.findByText(/still syncing/);
  clearReceipt(first.uid);
  auth.currentUser = { uid: 'new-session' } as User;
  view.unmount();
  openForm();
  await act(async () => ack());
  expect(readReceipt(first.uid)).toBeNull();
  expect(readReceipt(auth.currentUser.uid)).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByText('The practice')).toBeTruthy();
});

it('opens the journal after profile acknowledgement even when local receipt cleanup fails', async () => {
  vi.mocked(saveEntry).mockReturnValue({ outcome: Promise.resolve('saved'), final: Promise.resolve() });
  vi.mocked(api.post).mockResolvedValue({});
  const done = vi.fn();
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
  try {
    openForm(done);
    submitEntry();
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('could not clear the local receipt'));
    expect(readReceipt(auth.currentUser.uid)).toMatchObject({ status: 'saved' });
    expect(JSON.stringify(localStorage)).not.toContain('Private first entry');
    expect(api.post).toHaveBeenCalledOnce();
    expect(saveEntry).toHaveBeenCalledOnce();
  } finally {
    alert.mockRestore();
    remove.mockRestore();
  }
});
