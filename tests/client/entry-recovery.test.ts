import { beforeEach, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { confirmEntry, saveEntry } from '../../src/client/lib/entrySave';

const sdk = vi.hoisted(() => ({
  collection: vi.fn(), doc: vi.fn(), setDoc: vi.fn(), getDocFromServer: vi.fn(), waitForPendingWrites: vi.fn(),
}));
vi.mock('firebase/firestore', () => sdk);
vi.mock('../../src/client/lib/firebase', () => ({ db: 'db' }));
beforeEach(() => vi.resetAllMocks());

it('saves the first entry at the document ID already recorded in the receipt', async () => {
  const ref = { id: 'receipt-id' };
  sdk.collection.mockReturnValue('entries');
  sdk.doc.mockReturnValue(ref);
  sdk.setDoc.mockResolvedValue(undefined);
  const write = saveEntry({ uid: 'owner' } as User, 'First entry', ref.id);
  expect(await write.outcome).toBe('saved');
  expect(sdk.collection).toHaveBeenCalledWith('db', 'users/owner/notebook');
  expect(sdk.doc).toHaveBeenCalledWith('entries', 'receipt-id');
  expect(sdk.setDoc).toHaveBeenCalledWith(ref, { bodyMd: 'First entry', createdAt: expect.any(String), id: 'receipt-id' });
});

it('waits for queued writes and checks the account document on the server', async () => {
  let ack!: () => void;
  sdk.waitForPendingWrites.mockReturnValue(new Promise<void>((resolve) => { ack = resolve; }));
  sdk.doc.mockReturnValue('entry-ref');
  sdk.getDocFromServer.mockResolvedValue({ exists: () => true, metadata: { hasPendingWrites: false } });
  const recovering = confirmEntry('owner', 'receipt-id');
  expect(sdk.getDocFromServer).not.toHaveBeenCalled();
  ack();
  expect(await recovering).toBe(true);
  expect(sdk.doc).toHaveBeenCalledWith('db', 'users', 'owner', 'notebook', 'receipt-id');
  expect(sdk.getDocFromServer).toHaveBeenCalledWith('entry-ref');
});

it('keeps the result unconfirmed while Firestore still reports local changes', async () => {
  sdk.getDocFromServer.mockResolvedValue({ exists: () => true, metadata: { hasPendingWrites: true } });
  await expect(confirmEntry('owner', 'receipt-id')).rejects.toThrow('still syncing');
});
