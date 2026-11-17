// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { getToken as getAppCheckToken } from 'firebase/app-check';
import { auth } from '../../src/client/lib/firebase';
import { downloadExport } from '../../src/client/lib/api';
import { signOut } from '../../src/client/lib/auth';
import { freshInquiryDraft, readInquiryDraft, writeInquiryDraft } from '../../src/client/lib/inquiryDraft';
import { getNotebookDraft, setNotebookDraft } from '../../src/client/lib/notebookDraft';

const mockAuth = vi.hoisted(() => ({ currentUser: null as User | null }));
vi.mock('../../src/client/lib/firebase', () => ({
  auth: mockAuth, appCheck: {}, googleProvider: {}, useEmulators: true,
}));
vi.mock('firebase/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/auth')>(),
  signOut: vi.fn(), onAuthStateChanged: vi.fn(),
}));
vi.mock('firebase/app-check', () => ({ getToken: vi.fn() }));

function makeUser(uid: string): User {
  return { uid, getIdToken: vi.fn(async () => `token-${uid}`) } as unknown as User;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function storeDraft(uid: string, bodyMd: string) {
  const draft = { ...freshInquiryDraft(), bodyMd };
  writeInquiryDraft(uid, 'q1', draft);
  return draft;
}
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

let userA: User;
let userB: User;
let authObserver: ((user: User | null) => void) | undefined;
const unsubscribe = vi.fn();
const fetchMock = vi.fn<typeof fetch>();
const createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:account-export');
const revokeObjectURL = vi.fn();
function changeUser(user: User | null) {
  mockAuth.currentUser = user;
  authObserver?.(user);
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  userA = makeUser('account-a');
  userB = makeUser('account-b');
  mockAuth.currentUser = userA;
  authObserver = undefined;
  setNotebookDraft(userA.uid, '');
  setNotebookDraft(userB.uid, '');
  vi.mocked(onAuthStateChanged).mockImplementation((_auth, observer) => {
    authObserver = observer as (user: User | null) => void;
    return unsubscribe;
  });
  vi.mocked(fbSignOut).mockImplementation(async () => { changeUser(null); });
  vi.mocked(getAppCheckToken).mockResolvedValue({ token: 'app-check' });
  vi.stubGlobal('fetch', fetchMock);
  createObjectURL.mockReturnValue('blob:account-export');
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function expectNoDownload() {
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  expect(unsubscribe).toHaveBeenCalledOnce();
}

describe('downloadExport (actual client function)', () => {
  it('downloads server data with only the initiating user’s current drafts and token', async () => {
    const ownDraft = storeDraft(userA.uid, 'My unsaved writing');
    storeDraft(userB.uid, 'Another account’s private writing');
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ entries: ['saved writing'] }) } as Response);

    await downloadExport();

    expect(userA.getIdToken).toHaveBeenCalledOnce();
    expect(userB.getIdToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('/api/export', { headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer token-account-a', 'X-Firebase-AppCheck': 'app-check',
    } });
    const blob = createObjectURL.mock.calls[0]![0] as unknown as Blob;
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(await blobText(blob))).toEqual({
      entries: ['saved writing'], localInquiryDrafts: [{ inquiryId: 'q1', draft: ownDraft }],
    });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:account-export');
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(readInquiryDraft(userA.uid, 'q1')).toEqual(ownDraft);
  });

  it.each(['id-token', 'app-check'] as const)('does not fetch after auth changes while awaiting %s headers', async (stage) => {
    const pending = deferred<string>();
    if (stage === 'id-token') vi.mocked(userA.getIdToken).mockReturnValue(pending.promise);
    else vi.mocked(getAppCheckToken).mockImplementation(async () => ({ token: await pending.promise }));
    const exporting = downloadExport();
    await vi.waitFor(() => expect(stage === 'id-token' ? userA.getIdToken : getAppCheckToken).toHaveBeenCalled());
    changeUser(userB);
    pending.resolve('original-account-token');

    await expect(exporting).rejects.toThrow('Your account changed');
    expect(userB.getIdToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDownload();
  });

  it.each(['other-user', 'signed-out', 'new-session', 'returned-user'] as const)('discards a delayed fetch after an auth change: %s', async (change) => {
    storeDraft(userA.uid, 'A private draft');
    storeDraft(userB.uid, 'B private draft');
    const pending = deferred<Response>();
    const json = vi.fn(async () => ({ account: 'A' }));
    const readStorage = vi.spyOn(Storage.prototype, 'getItem');
    fetchMock.mockReturnValue(pending.promise);
    const exporting = downloadExport();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    // Also check the direct snapshot guard without waiting for Firebase's observer.
    if (change === 'other-user') mockAuth.currentUser = userB;
    if (change === 'signed-out') changeUser(null);
    if (change === 'new-session') changeUser(makeUser(userA.uid));
    if (change === 'returned-user') { changeUser(userB); changeUser(userA); }
    pending.resolve({ ok: true, json } as unknown as Response);

    await expect(exporting).rejects.toThrow('Your account changed');
    expect(json).not.toHaveBeenCalled();
    expect(readStorage).not.toHaveBeenCalled();
    expectNoDownload();
  });

  it('does not combine A’s server body with B’s drafts when auth changes during body reading', async () => {
    storeDraft(userA.uid, 'A private draft');
    storeDraft(userB.uid, 'B private draft');
    const pending = deferred<Record<string, unknown>>();
    const json = vi.fn(() => pending.promise);
    const readStorage = vi.spyOn(Storage.prototype, 'getItem');
    fetchMock.mockResolvedValue({ ok: true, json } as unknown as Response);
    const exporting = downloadExport();
    await vi.waitFor(() => expect(json).toHaveBeenCalledOnce());
    changeUser(userB);
    pending.resolve({ account: 'A', entries: ['private A writing'] });

    await expect(exporting).rejects.toThrow('Your account changed');
    expect(readStorage).not.toHaveBeenCalled();
    expectNoDownload();
  });

  it('rejects a signed-out export without fetching or downloading', async () => {
    mockAuth.currentUser = null;
    await expect(downloadExport()).rejects.toThrow('Sign in');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(onAuthStateChanged).not.toHaveBeenCalled();
  });

  it('releases its auth observer when the server export fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(downloadExport()).rejects.toThrow('export failed');
    expectNoDownload();
  });
});

describe('signOut (actual client function)', () => {
  it('preserves readable inquiry and Notebook drafts when discard is cancelled', async () => {
    const draft = storeDraft(userA.uid, 'Keep these words');
    setNotebookDraft(userA.uid, 'Notebook words');
    vi.mocked(window.confirm).mockReturnValue(false);

    await signOut();

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Save or export them first'));
    expect(readInquiryDraft(userA.uid, 'q1')).toEqual(draft);
    expect(getNotebookDraft(userA.uid)).toBe('Notebook words');
    expect(fbSignOut).not.toHaveBeenCalled();
    expect(auth.currentUser).toBe(userA);
  });

  it('clears only the consenting user’s drafts before calling Firebase signOut', async () => {
    storeDraft(userA.uid, 'Discard my draft');
    const otherDraft = storeDraft(userB.uid, 'Keep B’s draft');
    setNotebookDraft(userA.uid, 'Discard A’s Notebook');
    setNotebookDraft(userB.uid, 'Keep B’s Notebook');
    localStorage.setItem('unrelated', 'keep');
    vi.mocked(fbSignOut).mockImplementation(async () => {
      expect(readInquiryDraft(userA.uid, 'q1')).toBeNull();
      expect(getNotebookDraft(userA.uid)).toBe('');
      changeUser(null);
    });

    await signOut();

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
    expect(readInquiryDraft(userB.uid, 'q1')).toEqual(otherDraft);
    expect(getNotebookDraft(userB.uid)).toBe('Keep B’s Notebook');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it('signs out with no draft prompt when there is no unsaved inquiry writing', async () => {
    storeDraft(userA.uid, '   ');
    await signOut();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
  });

  const readFailures = ['access', 'getItem', 'key', 'length', 'malformed'] as const;
  function failDraftRead(failure: typeof readFailures[number]) {
    if (failure === 'access') {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('storage access denied'); });
    } else if (failure === 'malformed') {
      localStorage.setItem('lucilio-inquiry-draft:account-a:broken', '{not json');
    } else if (failure === 'length') {
      vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(() => { throw new Error('storage enumeration unavailable'); });
    } else {
      vi.spyOn(Storage.prototype, failure).mockImplementation(() => { throw new Error('storage unavailable'); });
    }
  }

  it.each(readFailures)('offers sign-out-anyway recovery after %s failure', async (failure) => {
    storeDraft(userA.uid, 'Readable writing must require consent');
    failDraftRead(failure);

    await signOut();

    expect(window.confirm).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/could not be read.*discard unsaved drafts.*may remain.*browser settings.*Sign out anyway/s));
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
    expect(auth.currentUser).toBeNull();
  });

  it.each(readFailures)('keeps readable drafts and authentication if recovery after %s is cancelled', async (failure) => {
    const draft = storeDraft(userA.uid, 'Keep readable writing');
    setNotebookDraft(userA.uid, 'Keep Notebook writing');
    failDraftRead(failure);
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    vi.mocked(window.confirm).mockReturnValue(false);

    await signOut();

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    expect(fbSignOut).not.toHaveBeenCalled();
    expect(auth.currentUser).toBe(userA);
    vi.restoreAllMocks();
    expect(readInquiryDraft(userA.uid, 'q1')).toEqual(draft);
    expect(getNotebookDraft(userA.uid)).toBe('Keep Notebook writing');
  });

  it.each([true, false])('allows accepting or cancelling sign-out after removal failure (continue: %s)', async (continueSignOut) => {
    const draft = storeDraft(userA.uid, 'Uncleared draft');
    setNotebookDraft(userA.uid, 'Notebook draft');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage removal unavailable'); });
    vi.mocked(window.confirm).mockReturnValueOnce(true).mockReturnValueOnce(continueSignOut);

    await signOut();

    expect(window.confirm).toHaveBeenNthCalledWith(1, expect.stringContaining('Sign out and clear drafts?'));
    expect(window.confirm).toHaveBeenNthCalledWith(2, expect.stringMatching(/could not be cleared.*may remain.*browser settings.*Sign out anyway/s));
    expect(fbSignOut).toHaveBeenCalledTimes(continueSignOut ? 1 : 0);
    expect(readInquiryDraft(userA.uid, 'q1')).toEqual(draft);
    expect(getNotebookDraft(userA.uid)).toBe(continueSignOut ? '' : 'Notebook draft');
  });

  it('offers recovery if storage enumeration fails during cleanup', async () => {
    const draft = storeDraft(userA.uid, 'Uncleared draft');
    const keys = Object.keys;
    vi.spyOn(Object, 'keys').mockImplementation((value) => {
      if (value === localStorage) throw new Error('storage enumeration blocked');
      return keys(value);
    });

    await signOut();

    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(window.confirm).toHaveBeenLastCalledWith(expect.stringContaining('Sign out anyway?'));
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
    expect(readInquiryDraft(userA.uid, 'q1')).toEqual(draft);
  });

  it('still signs out when both reading and clearing fail after recovery consent', async () => {
    storeDraft(userA.uid, 'Uncleared draft');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('read blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('remove blocked'); });

    await signOut();

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
  });

  it('uses prior deletion consent instead of prompting about readable or malformed drafts', async () => {
    storeDraft(userA.uid, 'Already consented to discard');
    localStorage.setItem('lucilio-inquiry-draft:account-a:broken', '{not json');
    vi.mocked(window.confirm).mockReturnValue(false);

    await signOut({ discardDrafts: true });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
  });

  it.each(['other-user', 'signed-out', 'new-session'] as const)('clears the initiating user’s drafts without signing out a changed session: %s', async (change) => {
    storeDraft(userA.uid, 'Discard A’s draft');
    const otherDraft = storeDraft(userB.uid, 'Keep B’s draft');
    setNotebookDraft(userA.uid, 'Discard A’s Notebook');
    setNotebookDraft(userB.uid, 'Keep B’s Notebook');
    const currentUser = change === 'other-user' ? userB : change === 'signed-out' ? null : makeUser(userA.uid);
    changeUser(currentUser);

    await signOut({ user: userA, discardDrafts: true });

    expect(readInquiryDraft(userA.uid, 'q1')).toBeNull();
    expect(getNotebookDraft(userA.uid)).toBe('');
    expect(readInquiryDraft(userB.uid, 'q1')).toEqual(otherDraft);
    expect(getNotebookDraft(userB.uid)).toBe('Keep B’s Notebook');
    expect(window.confirm).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    expect(fbSignOut).not.toHaveBeenCalled();
    expect(auth.currentUser).toBe(currentUser);
  });

  it('warns truthfully after initiating-user cleanup fails without clearing or signing out the new account', async () => {
    const ownDraft = storeDraft(userA.uid, 'Uncleared A draft');
    const otherDraft = storeDraft(userB.uid, 'Keep B’s draft');
    setNotebookDraft(userA.uid, 'Discard A’s Notebook');
    setNotebookDraft(userB.uid, 'Keep B’s Notebook');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('remove blocked'); });
    changeUser(userB);

    await signOut({ user: userA, discardDrafts: true });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/could not be cleared.*may remain.*browser settings/s));
    expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining('You will still be signed out'));
    expect(readInquiryDraft(userA.uid, 'q1')).toEqual(ownDraft);
    expect(getNotebookDraft(userA.uid)).toBe('');
    expect(readInquiryDraft(userB.uid, 'q1')).toEqual(otherDraft);
    expect(getNotebookDraft(userB.uid)).toBe('Keep B’s Notebook');
    expect(fbSignOut).not.toHaveBeenCalled();
    expect(auth.currentUser).toBe(userB);
  });

  it('warns and signs out without a cancellable prompt if deletion cleanup fails', async () => {
    const draft = storeDraft(userA.uid, 'Uncleared draft');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('remove blocked'); });
    vi.mocked(window.confirm).mockReturnValue(false);

    await signOut({ discardDrafts: true });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/could not be cleared.*may remain.*browser settings.*still be signed out/s));
    expect(fbSignOut).toHaveBeenCalledExactlyOnceWith(auth);
    expect(readInquiryDraft(userA.uid, 'q1')).toEqual(draft);
  });
});
