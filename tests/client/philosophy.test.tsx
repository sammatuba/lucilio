// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Philosophy from '../../src/client/views/Philosophy';
import Reading from '../../src/client/views/Reading';
import { philosophyPackSchema, type PhilosophyPack } from '../../src/shared/philosophy';
import type { User } from 'firebase/auth';
import type { Inquiry } from '../../src/shared/inquiry';

const session = vi.hoisted(() => ({ currentUser: { uid: 'reader' } as User }));
vi.mock('../../src/client/lib/firebase', () => ({ auth: session }));
vi.mock('../../src/client/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
import { api } from '../../src/client/lib/api';

// A local, schema-valid pack keeps the view contract independent of the
// concurrently authored edition, its reading IDs, and editorial wording.
function fixture(): PhilosophyPack {
  return {
    version: 'test-edition',
    coverageNote: 'A partial editorial map, with substantial traditions still absent.',
    sources: [
      { id: 'primary', title: 'A primary work', author: 'An author', kind: 'primary', url: 'https://example.org/primary', locator: 'Book II, sections 1–3', note: 'Check translation and context at the source.' },
      { id: 'reference', title: 'A scholarly orientation', author: 'A reference editor', kind: 'reference', url: 'https://example.org/reference', locator: 'Section 4: objections', note: 'A secondary account, not the author’s own words.' },
    ],
    nodes: [
      { id: 'reason', title: 'Reason and testimony', kind: 'concept', area: 'Western', summary: 'When another person offers reasons.', detailMd: 'A **source-guided orientation** distinguishes reliance from proof.', questions: ['What would change your view?'], sourceIds: ['primary'], readingIds: ['test-reading'], prerequisiteIds: ['community'] },
      { id: 'community', title: 'Community and obligation', kind: 'tradition', area: 'African', summary: 'An account of obligations within a community.', detailMd: 'Communal obligations need not erase disagreement.', questions: ['Who can challenge an obligation?'], sourceIds: ['reference'], readingIds: ['other-reading'], prerequisiteIds: [] },
      { id: 'practice', title: 'Cultivating a practice', kind: 'question', area: 'Chinese', summary: 'A question about learning through practice.', detailMd: 'Learning includes correction and attention.', questions: ['What does a habit teach?'], sourceIds: ['primary'], readingIds: [], prerequisiteIds: [] },
    ],
    readings: [
      { id: 'test-reading', title: 'A question between people', question: 'When should I accept another person’s claim?', standfirst: 'A reading invitation, not a test.', bodyMd: '### A concrete beginning\n\nAn original editorial opening, distinct from the primary source.\n\n' + Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1} considers a different reason for accepting a claim. A speaker can be honest but mistaken, and a listener can be careful yet unfair. The difficulty is not removed by choosing between suspicion and surrender. Compare what the speaker knows, what they risk, and what could correct their account before deciding what you owe them.`).join('\n\n'), counterpointMd: '### A serious objection\n\nA critic argues that scrutiny can itself become unfair.', prompts: { reflection: 'Describe one time you changed your mind about someone.', argument: 'Defend a claim and give the strongest objection to it.', revision: 'Keep your first version and revise one premise.' }, nodeIds: ['reason', 'community'], sourceIds: ['primary', 'reference'], minutes: 35, sourceNotes: 'This is an original editorial synthesis; the primary work is linked, not copied.' },
      { id: 'other-reading', title: 'An obligation reconsidered', question: 'Which obligations can I refuse?', standfirst: 'A second path.', bodyMd: 'An independently available essay.', counterpointMd: 'An alternative account of obligation.', prompts: { reflection: 'Recall an obligation.', argument: 'Give a reason.', revision: 'Reconsider a reason.' }, nodeIds: ['community'], sourceIds: ['reference'], minutes: 20, sourceNotes: 'Reference-only coverage for this test reading.' },
    ],
    relations: [
      { from: 'reason', to: 'community', kind: 'contrasts', explanation: 'These accounts weigh individual judgment and communal obligation differently; this is a comparison, not a lineage.', sourceIds: ['reference'] },
      { from: 'practice', to: 'reason', kind: 'explores', explanation: 'Repeated practice provides a different setting for asking how judgment is learned.', sourceIds: ['primary'] },
    ],
  };
}

function Location() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
}
function InquiryDestination() {
  const { id } = useParams();
  return <h1>Inquiry destination: {id}</h1>;
}
function open(path: string, navigation = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {navigation && <nav><Link to="/read/other-reading">Another reading</Link><Link to="/philosophy">Leave reading</Link></nav>}
      <Routes>
        <Route path="/philosophy" element={<Philosophy />} />
        <Route path="/read/:id" element={<Reading user={session.currentUser} />} />
        <Route path="/inquiry/:id" element={<InquiryDestination />} />
      </Routes>
      <Location />
    </MemoryRouter>,
  );
}
function saved(payload: unknown): Inquiry {
  return { ...(payload as Inquiry), status: 'active', revision: 0, createdAt: '2026-11-18T12:00:00.000Z', updatedAt: '2026-11-18T12:00:00.000Z' };
}
function entryList() { return screen.getByRole('list', { name: 'Map entries' }); }

beforeEach(() => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, run: () => unknown) => Promise.resolve(run()) } });
  localStorage.clear();
  session.currentUser = { uid: 'reader' } as User;
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
  vi.mocked(api.get).mockResolvedValue(fixture());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('independently browsable philosophy map', () => {
  it('times out an unresponsive library request and offers retry', async () => {
    vi.useFakeTimers();
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    open('/philosophy');
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole('alert').textContent).toContain('could not be opened');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
  it('validates and reads the pack, exposes every node, coverage, prerequisites and reading links', async () => {
    const pack = philosophyPackSchema.parse(fixture());
    open('/philosophy');
    expect(screen.getByRole('status').textContent).toMatch(/opening/i);
    await screen.findByRole('list', { name: 'Map entries' });
    expect(api.get).toHaveBeenCalledWith('/api/philosophy');
    expect(within(entryList()).getAllByRole('link')).toHaveLength(pack.nodes.length);
    expect(screen.getByText(pack.coverageNote)).toBeTruthy();
    expect(screen.getByText('source-guided orientation').tagName).toBe('STRONG');
    expect(screen.getByRole('heading', { level: 2, name: pack.nodes[0]!.title })).toBeTruthy();
    expect(screen.getByRole('link', { name: pack.readings[0]!.title }).getAttribute('href')).toBe('/read/test-reading');
    expect(screen.getAllByRole('link', { name: pack.nodes[1]!.title }).length).toBeGreaterThan(0);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('combines search and area filters without a hidden interest filter', async () => {
    open('/philosophy');
    await screen.findByRole('searchbox', { name: 'Search the map' });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'obligation' } });
    expect(within(entryList()).getAllByRole('link')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Western' } });
    expect(screen.getByText(/No entries match/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(entryList()).getAllByRole('link')).toHaveLength(fixture().nodes.length);
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Chinese' } });
    expect(within(entryList()).getAllByRole('link')).toHaveLength(1);
    expect(within(entryList()).getByRole('link').textContent).toContain(fixture().nodes[2]!.title);
  });

  it('navigates explained relationships with kinds and sources and preserves inquiry context', async () => {
    const pack = fixture();
    open('/philosophy?node=reason&inquiry=my-inquiry&area=Western');
    await screen.findByRole('list', { name: 'All explained connections' });
    const relations = screen.getByRole('list', { name: 'All explained connections' });
    expect(within(relations).getByText(pack.relations[0]!.explanation)).toBeTruthy();
    expect(within(relations).getByText('contrasts')).toBeTruthy();
    expect(within(relations).getByText(pack.sources[1]!.locator)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Connections around Reason/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to your inquiry' }).getAttribute('href')).toBe('/inquiry/my-inquiry');
    fireEvent.click(within(relations).getByRole('link', { name: pack.nodes[1]!.title }));
    expect(screen.getByRole('heading', { level: 2, name: pack.nodes[1]!.title })).toBeTruthy();
    expect(screen.getByText(/outside your current filters/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: pack.nodes[1]!.title }));
    expect(screen.getByTestId('location').textContent).toContain('inquiry=my-inquiry');
    expect(screen.getByTestId('location').textContent).toContain('area=Western');
    const attach = screen.getByRole('link', { name: /Consider “Community/ });
    expect(attach.getAttribute('href')).toBe('/inquiry/my-inquiry?node=community');
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(attach);
    expect(screen.getByTestId('location').textContent).toBe('/inquiry/my-inquiry?node=community');
  });

  it('supports direct node selection and follows a prerequisite without fetching another pack', async () => {
    open('/philosophy?node=practice');
    await screen.findByRole('heading', { level: 2, name: fixture().nodes[2]!.title });
    fireEvent.click(within(entryList()).getByRole('link', { name: /Reason and testimony/ }));
    const links = screen.getAllByRole('link', { name: fixture().nodes[1]!.title });
    fireEvent.click(links[0]!);
    expect(screen.getByRole('heading', { level: 2, name: fixture().nodes[1]!.title })).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('keeps malformed and unknown node/inquiry/area links out of actions without hiding the map', async () => {
    open('/philosophy?node=%3Cmissing%3E&inquiry=bad%2Fid&area=Imaginary');
    await screen.findByText('That entry is not in this edition');
    expect(screen.getByText(/This inquiry link is not valid/)).toBeTruthy();
    expect(screen.getByText(/That area is not in this edition/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Back to your inquiry' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(entryList()).getAllByRole('link')).toHaveLength(fixture().nodes.length);
    fireEvent.click(within(entryList()).getByRole('link', { name: /Reason and testimony/ }));
    expect(screen.getByRole('heading', { level: 2, name: fixture().nodes[0]!.title })).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('bounds the SVG to six neighbors while retaining every keyboard-operable text connection', async () => {
    const pack = fixture();
    for (let index = 0; index < 7; index++) {
      pack.nodes.push({ ...pack.nodes[2]!, id: `extra-${index}`, title: `Extra entry ${index}` });
      pack.relations.push({ from: 'reason', to: `extra-${index}`, kind: 'context', explanation: `Context ${index}`, sourceIds: ['primary'] });
    }
    vi.mocked(api.get).mockResolvedValue(pack);
    open('/philosophy?node=reason');
    const graph = await screen.findByRole('img', { name: /Connections around Reason/ });
    expect(graph.querySelectorAll('.philosophy-graph-neighbor')).toHaveLength(6);
    const list = screen.getByRole('list', { name: 'All explained connections' });
    expect(list.children).toHaveLength(9);
    expect(within(list).getByRole('link', { name: 'Extra entry 6' }).getAttribute('href')).toContain('node=extra-6');
    fireEvent.click(screen.getByRole('button', { name: 'Next neighbors' }));
    expect(graph.querySelectorAll('.philosophy-graph-neighbor')).toHaveLength(3);
    expect(screen.getByText('Diagram 7–9 of 9')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous neighbors' }));
    expect(graph.querySelectorAll('.philosophy-graph-neighbor')).toHaveLength(6);
  });

  it('handles a node with no prerequisites, related essay, or connections honestly', async () => {
    const pack = fixture();
    pack.relations = [];
    vi.mocked(api.get).mockResolvedValue(pack);
    open('/philosophy?node=practice');
    expect(await screen.findByText(/No companion essay/)).toBeTruthy();
    expect(screen.getByText('No prerequisite reading is needed.')).toBeTruthy();
    expect(screen.getByText('No connections are recorded for this entry yet.')).toBeTruthy();
  });

  it.each(['network', 'schema', 'references'])('offers a safe pack retry after a %s failure', async (failure) => {
    if (failure === 'network') vi.mocked(api.get).mockRejectedValueOnce(new Error('private internal error'));
    else if (failure === 'schema') vi.mocked(api.get).mockResolvedValueOnce({ nodes: [] });
    else {
      const pack = fixture();
      pack.nodes[0]!.sourceIds = ['missing-source'];
      vi.mocked(api.get).mockResolvedValueOnce(pack);
    }
    open('/philosophy');
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be opened/);
    expect(screen.queryByText(/private internal error/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('list', { name: 'Map entries' });
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});

describe('reading-first practice', () => {
  it('releases a stalled create and retries its unchanged operation safely', async () => {
    open('/read/test-reading');
    await screen.findByRole('button', { name: 'Begin an inquiry' });
    vi.useFakeTimers();
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Begin an inquiry' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole('alert').textContent).toContain('could not confirm');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again to begin an inquiry' })); });
    expect(vi.mocked(api.post).mock.calls[0]![1]).toEqual(vi.mocked(api.post).mock.calls[1]![1]);
  });
  it('renders the entire editorial essay, optional counterpoint, invitations, rhythm, and source locators', async () => {
    const pack = fixture();
    open('/read/test-reading');
    expect(await screen.findByRole('heading', { level: 1, name: pack.readings[0]!.title })).toBeTruthy();
    expect(screen.getByText(/Paragraph 12 considers/)).toBeTruthy();
    expect(screen.getByText(/An original editorial essay/)).toBeTruthy();
    const counterpoint = screen.getByText('A contrasting position').closest('details')!;
    expect(counterpoint.open).toBe(false);
    fireEvent.click(screen.getByText('A contrasting position'));
    expect(counterpoint.open).toBe(true);
    expect(within(counterpoint).getByText(/A critic argues/)).toBeTruthy();
    for (const prompt of Object.values(pack.readings[0]!.prompts)) expect(screen.getByText(prompt)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'A rhythm for 2–3 hours' })).toBeTruthy();
    expect(screen.getByText(/No AI or research topic is required/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Read a short primary passage' })).toBeTruthy();
    for (const source of pack.sources) {
      const links = screen.getAllByRole('link', { name: new RegExp(source.title) });
      for (const link of links) {
        expect(link.getAttribute('href')).toBe(source.url);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      }
      expect(screen.getAllByText(source.locator).length).toBeGreaterThan(0);
    }
    const question = screen.getByRole('textbox', { name: 'Your initial question' }) as HTMLTextAreaElement;
    expect(question.value).toBe(pack.readings[0]!.question);
    expect(question.maxLength).toBe(300);
    fireEvent.change(question, { target: { value: 'An entirely unrelated personal question?' } });
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/api/philosophy');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('restores an unsubmitted question on return without creating an inquiry', async () => {
    const first = open('/read/test-reading');
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Still thinking…' } });
    first.unmount();
    open('/read/test-reading');
    expect((await screen.findByRole('textbox') as HTMLTextAreaElement).value).toBe('Still thinking…');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sanitizes editorial markdown and gives its external links safe behavior', async () => {
    const pack = fixture();
    pack.readings[0]!.bodyMd = 'An essay with [context](https://example.org/context). <script>alert(1)</script><img src=x onerror=alert(1)>';
    vi.mocked(api.get).mockResolvedValue(pack);
    open('/read/test-reading');
    const link = await screen.findByRole('link', { name: 'context' });
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(document.querySelector('.reading-essay script')).toBeNull();
    expect(document.querySelector('.reading-essay img')).toBeNull();
  });

  it('creates only on an explicit action and navigates with the saved inquiry ID', async () => {
    vi.mocked(api.post).mockImplementation(async (_path, payload) => saved(payload));
    open('/read/test-reading');
    const question = await screen.findByRole('textbox', { name: 'Your initial question' });
    fireEvent.change(question, { target: { value: '  What do I owe a stranger?  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Begin an inquiry' }));
    await screen.findByRole('heading', { name: /Inquiry destination:/ });
    const [path, payload] = vi.mocked(api.post).mock.calls[0]!;
    expect(path).toBe('/api/inquiries');
    expect(payload).toEqual({ id: expect.any(String), question: 'What do I owe a stranger?', readingId: 'test-reading', parentId: null, nodeIds: fixture().readings[0]!.nodeIds });
    expect((payload as Inquiry).id).toMatch(/^[a-f0-9-]{36}$/);
    expect(screen.getByTestId('location').textContent).toBe(`/inquiry/${(payload as Inquiry).id}`);
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('preserves the question and candidate ID across an ambiguous failure and unchanged retry', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('private backend detail'))
      .mockImplementationOnce(async (_path, payload) => saved(payload));
    open('/read/test-reading');
    const question = await screen.findByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(question, { target: { value: 'May I leave this open?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Begin an inquiry' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not confirm/);
    expect(question.value).toBe('May I leave this open?');
    expect(screen.queryByText(/private backend detail/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again to begin an inquiry' }));
    await screen.findByRole('heading', { name: /Inquiry destination:/ });
    expect(vi.mocked(api.post).mock.calls[1]![1]).toEqual(vi.mocked(api.post).mock.calls[0]![1]);
  });

  it('uses a new ID for changed content and reuses the earlier ID when an earlier snapshot is restored', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('ambiguous'));
    open('/read/test-reading');
    const question = await screen.findByRole('textbox');
    for (const value of ['A first question?', 'A different question?', 'A first question?']) {
      fireEvent.change(question, { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: /begin an inquiry/i }));
      await screen.findByRole('alert');
    }
    const calls = vi.mocked(api.post).mock.calls.map((call) => call[1] as Inquiry);
    expect(calls).toHaveLength(3);
    expect(calls[1]!.id).not.toBe(calls[0]!.id);
    expect(calls[2]).toEqual(calls[0]);
  });

  it('restores the edited question and retry payload after reload, scoped to user and reading', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('lost response'))
      .mockImplementationOnce(async (_path, payload) => saved(payload));
    const owner = session.currentUser;
    let view = open('/read/test-reading');
    const field = await screen.findByRole('textbox');
    const jump = screen.getByRole('link', { name: 'Jump to your question' });
    expect(document.querySelector(jump.getAttribute('href')!)?.textContent).toBe('Make the question your own');
    fireEvent.change(field, { target: { value: '  Can I reconsider?  ' } });
    fireEvent.submit(field.closest('form')!);
    await screen.findByRole('alert');
    view.unmount();

    session.currentUser = { uid: 'another-reader' } as User;
    view = open('/read/test-reading');
    expect((await screen.findByRole('textbox') as HTMLTextAreaElement).value).toBe(fixture().readings[0]!.question);
    view.unmount();
    session.currentUser = owner;
    view = open('/read/other-reading');
    expect((await screen.findByRole('textbox') as HTMLTextAreaElement).value).toBe(fixture().readings[1]!.question);
    view.unmount();

    open('/read/test-reading');
    const restored = await screen.findByRole('textbox') as HTMLTextAreaElement;
    expect(restored.value).toBe('  Can I reconsider?  ');
    expect(api.post).toHaveBeenCalledTimes(1);
    fireEvent.submit(restored.closest('form')!);
    await screen.findByRole('heading', { name: /Inquiry destination:/ });
    expect(vi.mocked(api.post).mock.calls[1]).toEqual(vi.mocked(api.post).mock.calls[0]);
    expect(localStorage.length).toBe(0);
  });

  it('reopens the unresolved question after a different question succeeds', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('response lost'))
      .mockImplementation(async (_path, payload) => saved(payload));
    const view = open('/read/test-reading');
    const field = await screen.findByRole('textbox');
    fireEvent.change(field, { target: { value: 'First question?' } });
    fireEvent.submit(field.closest('form')!);
    await screen.findByRole('alert');
    fireEvent.change(field, { target: { value: 'Second question?' } });
    fireEvent.submit(field.closest('form')!);
    await screen.findByRole('heading', { name: /Inquiry destination:/ });
    view.unmount();
    open('/read/test-reading');
    const restored = await screen.findByRole('textbox') as HTMLTextAreaElement;
    expect(restored.value).toBe('First question?');
    fireEvent.submit(restored.closest('form')!);
    await screen.findByRole('heading', { name: /Inquiry destination:/ });
    expect(vi.mocked(api.post).mock.calls[2]).toEqual(vi.mocked(api.post).mock.calls[0]);
  });

  it('opens a confirmed inquiry when its device draft cannot be cleared', async () => {
    vi.mocked(api.post).mockImplementation(async (_path, payload) => saved(payload));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage blocked'); });
    open('/read/test-reading');
    const field = await screen.findByRole('textbox');
    fireEvent.submit(field.closest('form')!);
    await screen.findByRole('heading', { name: /Inquiry destination:/ });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('reuses an ambiguous attempt from another already-open reading tab', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('lost response'))
      .mockImplementationOnce(async (_path, payload) => saved(payload));
    const first = open('/read/test-reading');
    const second = open('/read/test-reading');
    for (const tab of [first, second]) {
      const field = await within(tab.container).findByRole('textbox');
      fireEvent.change(field, { target: { value: 'Can I reconsider?' } });
    }
    fireEvent.submit(within(first.container).getByRole('textbox').closest('form')!);
    await within(first.container).findByRole('alert');
    fireEvent.submit(within(second.container).getByRole('textbox').closest('form')!);
    await within(second.container).findByRole('heading', { name: /Inquiry destination:/ });
    expect(vi.mocked(api.post).mock.calls[1]).toEqual(vi.mocked(api.post).mock.calls[0]);
  });

  it('retains the editor retry ID when another tab already confirmed the shared attempt', async () => {
    let confirm!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementationOnce(() => new Promise(resolve => { confirm = resolve; }))
      .mockRejectedValueOnce(new Error('lost response')).mockImplementationOnce(async (_path, body) => saved(body));
    const first = open('/read/test-reading');
    const second = open('/read/test-reading');
    for (const tab of [first, second]) {
      const field = await within(tab.container).findByRole('textbox');
      fireEvent.submit(field.closest('form')!);
      await waitFor(() => expect(api.post).toHaveBeenCalledTimes(tab === first ? 1 : 2));
    }
    await within(second.container).findByRole('alert');
    await act(async () => { confirm(saved(vi.mocked(api.post).mock.calls[0]![1])); });
    await within(first.container).findByRole('heading', { name: /Inquiry destination:/ });
    fireEvent.click(within(second.container).getByRole('button', { name: 'Try again to begin an inquiry' }));
    await within(second.container).findByRole('heading', { name: /Inquiry destination:/ });
    expect(vi.mocked(api.post).mock.calls[2]).toEqual(vi.mocked(api.post).mock.calls[0]);
  });

  it('rejects whitespace and oversized initial questions without making a write', async () => {
    open('/read/test-reading');
    const question = await screen.findByRole('textbox');
    for (const value of ['   ', 'a'.repeat(301)]) {
      fireEvent.change(question, { target: { value } });
      const button = screen.getByRole('button', { name: 'Begin an inquiry' }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.submit(question.closest('form')!);
    }
    expect(api.post).not.toHaveBeenCalled();
  });

  it('blocks duplicate submissions and does not navigate away from a newer reading when a save finishes', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.post).mockReturnValue(new Promise((done) => { resolve = done; }));
    open('/read/test-reading', true);
    const question = await screen.findByRole('textbox');
    fireEvent.submit(question.closest('form')!);
    fireEvent.submit(question.closest('form')!);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/Saving your question/);
    fireEvent.click(screen.getByRole('link', { name: 'Another reading' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(fixture().readings[1]!.question);
    await act(async () => { resolve(saved(vi.mocked(api.post).mock.calls[0]![1])); });
    expect(screen.getByTestId('location').textContent).toBe('/read/other-reading');
  });

  it('distinguishes an unknown reading from a load failure and lists available readings', async () => {
    open('/read/not-an-edition-id');
    expect(await screen.findByRole('heading', { name: 'Reading not found' })).toBeTruthy();
    for (const reading of fixture().readings) {
      expect(screen.getByRole('link', { name: reading.title }).getAttribute('href')).toBe(`/read/${reading.id}`);
    }
    expect(api.post).not.toHaveBeenCalled();
  });

  it('retries a failed pack load without creating an inquiry or clearing the reading route', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    open('/read/test-reading');
    await screen.findByRole('alert');
    expect(screen.queryByRole('heading', { name: 'Reading not found' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: fixture().readings[0]!.title });
    expect(screen.getByTestId('location').textContent).toBe('/read/test-reading');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('labels reference-only primary-passage coverage honestly', async () => {
    open('/read/other-reading');
    expect(await screen.findByText(/No directly linked primary text/)).toBeTruthy();
    expect(screen.queryByText('Primary text')).toBeNull();
  });

  it('ignores a pack response after leaving the reading view', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    open('/read/test-reading', true);
    fireEvent.click(screen.getByRole('link', { name: 'Leave reading' }));
    await screen.findByRole('list', { name: 'Map entries' });
    await act(async () => { resolve(fixture()); });
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(screen.getByTestId('location').textContent).toBe('/philosophy');
  });
});
