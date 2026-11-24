// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { User } from 'firebase/auth';
import Inquiry from '../../src/client/views/Inquiry';
import Practice from '../../src/client/views/Practice';
import { api, ApiError } from '../../src/client/lib/api';
import { clearInquiryDrafts, exportInquiryDrafts, readInquiryDraft } from '../../src/client/lib/inquiryDraft';
import type { InquiryDetail, InquiryWriting } from '../../src/shared/inquiry';
import type { PhilosophyPack } from '../../src/shared/philosophy';

vi.mock('../../src/client/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message); } } }));
const user = { uid: 'inquiry-reader' } as User;
const pack: PhilosophyPack = {
  version: 'test', coverageNote: 'An introductory edition, not all philosophy.',
  sources: [{ id: 's', title: 'Testimony', author: 'Reference', url: 'https://plato.stanford.edu/entries/testimony-episprob/', kind: 'reference', locator: 'Section 1', note: 'Overview' }],
  nodes: [{ id: 'testimony', title: 'Testimony', area: 'Knowledge', kind: 'concept', summary: 'Learning from others.', detailMd: 'Reasons for trusting another person.', questions: ['Why trust?'], sourceIds: ['s'], readingIds: ['trust'], prerequisiteIds: [] }],
  relations: [],
  readings: [{ id: 'trust', title: 'Another mind', question: 'When should I rely on another mind?', standfirst: 'An invitation to think about trust.', bodyMd: 'A substantial argument would appear here.', counterpointMd: 'Not all reliance is passive.', prompts: { reflection: 'Recall a moment of trust.', argument: 'Defend a claim.', revision: 'Meet an objection.' }, nodeIds: ['testimony'], sourceIds: ['s'], minutes: 12, sourceNotes: 'Editorial comparison.' }],
};
let data: InquiryDetail;
let writes: InquiryWriting[];
function Location() { const location = useLocation(); return <output aria-label="Location">{location.pathname}</output>; }
function setup(path = '/inquiry/q1', who = user) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/inquiry/:id" element={<Inquiry user={who} />} /><Route path="/" element={<Practice />} /></Routes><Location /></MemoryRouter>);
}
async function openEditor() { setup(); return await screen.findByLabelText('Your writing') as HTMLTextAreaElement; }
beforeEach(() => {
  localStorage.clear(); vi.resetAllMocks();
  writes = [];
  data = { inquiry: { id: 'q1', question: 'When should I trust?', readingId: 'trust', parentId: null, nodeIds: [], status: 'active', revision: 0, createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z' }, writings: writes, branches: [] };
  vi.mocked(api.get).mockImplementation(async (path) => {
    if (path === '/api/philosophy') return pack;
    if (path === '/api/inquiries') return { inquiries: [data.inquiry] };
    return data;
  });
  vi.mocked(api.post).mockImplementation(async (path, raw) => {
    const body = raw as Record<string, unknown>;
    if (path.endsWith('/notebook')) return { entryId: 'inquiry-w1' };
    if (path.endsWith('/writings')) {
      const writing = { ...body, inquiryId: 'q1', createdAt: '2026-11-18T01:00:00Z' } as InquiryWriting;
      writes.push(writing); return writing;
    }
    if (path === '/api/inquiries') return { ...data.inquiry, ...body };
    return { ...data.inquiry, ...body, revision: 1 };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Personal inquiry journey', () => {
  it('starts from reading without requiring writing or invoking a model', async () => {
    vi.mocked(api.get).mockImplementation(async (path) => path === '/api/philosophy' ? pack : { inquiries: [] });
    setup('/');
    expect(await screen.findByRole('link', { name: 'Read the essay' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Read the essay' }).getAttribute('href')).toBe('/read/trust');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('leads with the latest active inquiry and keeps resting questions folded', async () => {
    const latest = { ...data.inquiry, id: 'latest', question: 'What do I owe a stranger?' };
    const paused = { ...latest, id: 'paused', question: 'Where was I?', status: 'paused' };
    vi.mocked(api.get).mockImplementation(async (path) => path === '/api/philosophy' ? pack : { inquiries: [paused, latest, data.inquiry] });
    setup('/');
    expect((await screen.findByRole('link', { name: 'Continue this question' })).getAttribute('href')).toBe('/inquiry/latest');
    expect(screen.getByRole('heading', { name: latest.question })).toBeTruthy();
    expect(screen.getByRole('link', { name: /When should I trust/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: paused.question })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show paused and resting/ }));
    expect(screen.getByRole('heading', { name: paused.question })).toBeTruthy();
  });
  it('branches to a personal question unrelated to research', async () => {
    await openEditor();
    fireEvent.change(screen.getByLabelText('The question I want to follow'), { target: { value: 'Can friendship leave room for disagreement?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Follow this question' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/inquiries', expect.objectContaining({ parentId: 'q1', question: 'Can friendship leave room for disagreement?' })));
  });
  it('keeps an unchanged operation id when a branch request is retried', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    await openEditor();
    fireEvent.change(screen.getByLabelText('The question I want to follow'), { target: { value: 'Why do I avoid disagreement?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Follow this question' }));
    await screen.findByText(/The branch was not confirmed/);
    fireEvent.click(screen.getByRole('button', { name: 'Follow this question' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0]![1]).toEqual(vi.mocked(api.post).mock.calls[1]![1]);
  });
  it('retries the original branch snapshot after the parent gains a connection', async () => {
    const post = vi.mocked(api.post).getMockImplementation()!;
    let committed: Record<string, unknown> | undefined;
    vi.mocked(api.post).mockImplementation(async (path, raw) => {
      if (path !== '/api/inquiries') return post(path, raw);
      if (!committed) {
        committed = structuredClone(raw as Record<string, unknown>);
        throw new Error('response lost after branch committed');
      }
      if (JSON.stringify(raw) !== JSON.stringify(committed)) throw new ApiError(409, 'different create snapshot');
      return { ...data.inquiry, ...committed };
    });
    setup('/inquiry/q1?node=testimony');
    await screen.findByLabelText('Your writing');
    fireEvent.change(screen.getByLabelText('The question I want to follow'), { target: { value: 'Why do I avoid disagreement?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Follow this question' }));
    await screen.findByText(/The branch was not confirmed/);
    fireEvent.click(screen.getByRole('button', { name: 'Keep this connection' }));
    await screen.findByRole('link', { name: /^Testimony$/ });
    fireEvent.click(screen.getByRole('button', { name: 'Follow this question' }));
    await waitFor(() => expect(screen.getByLabelText('Location').textContent).toBe(`/inquiry/${committed!.id}`));
    const branches = vi.mocked(api.post).mock.calls.filter(([path]) => path === '/api/inquiries');
    expect(branches).toHaveLength(2);
    expect(branches[0]![1]).toEqual(branches[1]![1]);
    expect(committed!.nodeIds).toEqual([]);
    expect(api.post).toHaveBeenCalledWith('/api/inquiries/q1', { nodeIds: ['testimony'], revision: 0 });
  });
  it('stores a draft locally, survives remount, and scopes it by account', async () => {
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'A thought not yet ready.' } });
    expect(readInquiryDraft(user.uid, 'q1')?.bodyMd).toBe('A thought not yet ready.');
    cleanup(); setup();
    expect((await screen.findByLabelText('Your writing') as HTMLTextAreaElement).value).toBe('A thought not yet ready.');
    cleanup(); setup('/inquiry/q1', { uid: 'other-reader' } as User);
    expect((await screen.findByLabelText('Your writing') as HTMLTextAreaElement).value).toBe('');
  });
  it('preserves failed writing and retries without a duplicate operation id', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'My reasons for doubt.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await screen.findByText(/The save could not be confirmed/);
    expect(editor.value).toBe('My reasons for doubt.');
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0]![1]).toEqual(vi.mocked(api.post).mock.calls[1]![1]);
  });
  it('rotates a recovered operation ID when editing after a committed save loses its response', async () => {
    const post = vi.mocked(api.post).getMockImplementation()!;
    vi.mocked(api.post).mockImplementationOnce(async (...args) => {
      await post(...args);
      throw new Error('response lost after commit');
    });
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'Original committed thought.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await screen.findByText(/The save could not be confirmed/);
    const committedId = writes[0]!.id;
    cleanup(); setup();
    const recovered = await screen.findByLabelText('Your writing') as HTMLTextAreaElement;
    expect(recovered.value).toBe('Original committed thought.');
    fireEvent.change(recovered, { target: { value: 'Changed after reload.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await screen.findByText(/Saved to your inquiry/);
    expect(writes).toHaveLength(2);
    expect(writes[1]!.id).not.toBe(committedId);
    expect(writes[0]!.bodyMd).toBe('Original committed thought.');
  });
  it('retries an unchanged recovered draft with its original operation ID', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('offline'));
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'Retry this unchanged.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await screen.findByText(/The save could not be confirmed/);
    const original = vi.mocked(api.post).mock.calls[0]![1];
    cleanup(); setup();
    await screen.findByLabelText('Your writing');
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await screen.findByText(/The save could not be confirmed/);
    expect(vi.mocked(api.post).mock.calls[1]![1]).toEqual(original);
  });
  it('does not clear newer typing when an older save completes', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.post).mockReturnValue(new Promise((r) => { resolve = r; }));
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'First version.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    const payload = vi.mocked(api.post).mock.calls[0]![1] as Record<string, unknown>;
    fireEvent.change(editor, { target: { value: 'First version. Another thought.' } });
    await act(async () => resolve({ ...payload, inquiryId: 'q1', createdAt: '2026-11-18T01:00:00Z' }));
    expect(editor.value).toBe('First version. Another thought.');
    expect(readInquiryDraft(user.uid, 'q1')?.bodyMd).toBe(editor.value);
  });
  it('retains originals while saving linked revisions and invokes no model', async () => {
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'Trust always helps.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await screen.findByText(/Saved to your inquiry/);
    fireEvent.click(screen.getByRole('button', { name: 'Revise this piece' }));
    expect(editor.value).toBe('Trust always helps.');
    fireEvent.change(editor, { target: { value: 'Trust can help when criticism remains possible.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Revise this piece' })).toHaveLength(2));
    expect(writes[1]!.revisesId).toBe(writes[0]!.id);
    expect(writes[0]!.bodyMd).toBe('Trust always helps.');
    expect(vi.mocked(api.post).mock.calls.every(([path]) => path.endsWith('/writings'))).toBe(true);
  });
  it('links each explicitly copied piece to its acknowledged Notebook entry and keeps the inquiry draft', async () => {
    const first: InquiryWriting = { id: 'w1', inquiryId: 'q1', bodyMd: 'First piece', mode: 'argument', revisesId: null, sourceNodeId: null, createdAt: '2026-11-18T00:00:00Z' };
    data.writings = [first, { ...first, id: 'w2', bodyMd: 'Second piece' }];
    vi.mocked(api.post).mockResolvedValueOnce({}).mockResolvedValueOnce({ entryId: 'ack-A' }).mockResolvedValueOnce({ entryId: 'ack-B' });
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'Still thinking.' } });
    for (const summary of screen.getAllByText('Optional: take this piece to the Notebook')) fireEvent.click(summary);
    const buttons = screen.getAllByRole('button', { name: 'Copy this piece to Notebook' });
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(buttons[0]!);
    await screen.findByText(/copy was not confirmed/i);
    expect(screen.queryByRole('link', { name: 'Open the copied entry' })).toBeNull();

    fireEvent.click(buttons[0]!);
    const firstLink = await screen.findByRole('link', { name: 'Open the copied entry' });
    expect(firstLink.getAttribute('href')).toBe('/notebook?entry=ack-A');
    expect(firstLink.closest('article')?.id).toBe('writing-w1');
    fireEvent.click(buttons[1]!);
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Open the copied entry' })).toHaveLength(2));
    const secondLink = screen.getAllByRole('link', { name: 'Open the copied entry' })[1]!;
    expect(secondLink.getAttribute('href')).toBe('/notebook?entry=ack-B');
    expect(secondLink.closest('article')?.id).toBe('writing-w2');
    expect(api.post).toHaveBeenCalledTimes(3);
    expect(api.post).toHaveBeenLastCalledWith('/api/inquiries/q1/writings/w2/notebook');
    expect(readInquiryDraft(user.uid, 'q1')?.bodyMd).toBe(editor.value);
    expect(editor.value).toBe('Still thinking.');
  });
  it('requires an earlier saved piece when choosing the revision approach', async () => {
    data.writings = [{ id: 'w1', inquiryId: 'q1', bodyMd: 'Earlier claim', mode: 'argument', revisesId: null, sourceNodeId: null, createdAt: '2026-11-18T00:00:00Z' }];
    const editor = await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /^Revision$/ }));
    fireEvent.change(editor, { target: { value: 'A more precise claim.' } });
    expect((screen.getByRole('button', { name: 'Save writing' }) as HTMLButtonElement).disabled).toBe(true);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Earlier piece to revise'), { target: { value: 'w1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save writing' }));
    await screen.findByText(/Saved to your inquiry/);
    expect(api.post).toHaveBeenCalledWith('/api/inquiries/q1/writings', expect.objectContaining({ mode: 'revision', revisesId: 'w1', bodyMd: 'A more precise claim.' }));
  });
  it('does not replace an existing draft when revision is selected', async () => {
    data.writings = [{ id: 'w1', inquiryId: 'q1', bodyMd: 'Earlier claim', mode: 'argument', revisesId: null, sourceNodeId: null, createdAt: '2026-11-18T00:00:00Z' }];
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'Unfinished thought' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revise this piece' }));
    expect(await screen.findByText(/There is already a draft/)).toBeTruthy();
    expect(editor.value).toBe('Unfinished thought');
  });
  it('keeps question text when a concurrent update conflicts', async () => {
    vi.mocked(api.post).mockRejectedValue(new ApiError(409, 'conflict'));
    await openEditor();
    fireEvent.click(screen.getByText('Let the question evolve'));
    fireEvent.change(screen.getByLabelText('Current question'), { target: { value: 'When should I reconsider?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }));
    expect(await screen.findByText(/changed in another view/)).toBeTruthy();
    expect((screen.getByLabelText('Current question') as HTMLInputElement).value).toBe('When should I reconsider?');
  });
  it('requires explicit action before keeping a map connection', async () => {
    setup('/inquiry/q1?node=testimony');
    const button = await screen.findByRole('button', { name: 'Keep this connection' });
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(button);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/inquiries/q1', { nodeIds: ['testimony'], revision: 0 }));
  });
  it('supports pausing without a forced deadline', async () => {
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Pause inquiry' }));
    expect(await screen.findByRole('button', { name: 'Resume inquiry' })).toBeTruthy();
    expect(screen.getByLabelText('Your writing')).toBeTruthy();
  });
  it('warns when device storage fails without losing the current text', async () => {
    const editor = await openEditor();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fireEvent.change(editor, { target: { value: 'Keep these words.' } });
    expect(screen.getByText(/could not be stored on this device/)).toBeTruthy();
    expect(editor.value).toBe('Keep these words.');
    expect((screen.getByRole('button', { name: 'Download this draft' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('exports and clears only the current account drafts', async () => {
    const editor = await openEditor();
    fireEvent.change(editor, { target: { value: 'One account only' } });
    expect(exportInquiryDrafts(user.uid)).toHaveLength(1);
    expect(exportInquiryDrafts('other')).toEqual([]);
    clearInquiryDrafts('other');
    expect(readInquiryDraft(user.uid, 'q1')?.bodyMd).toBe('One account only');
    clearInquiryDrafts(user.uid);
    expect(exportInquiryDrafts(user.uid)).toEqual([]);
  });
});
