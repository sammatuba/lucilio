// Private, server-owned inquiry collections. Nothing here invokes correspondence
// or a model; only an explicit Notebook copy crosses into the existing journal.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Router, type RequestHandler, type Response } from 'express';
import type { z } from 'zod';
import {
  inquiryCreateSchema, inquiryIdSchema, inquiryUpdateSchema, inquiryWritingCreateSchema,
  type Inquiry, type InquiryDetail, type InquiryWriting,
} from '../../shared/inquiry.js';
import { emptyBodySchema, entryCreateSchema, type EntryDoc } from '../../shared/schemas.js';
import { adminDb } from '../firebase.js';
import { protectedRoute, type AuthedRequest, type RouteDeps } from '../middleware.js';
import { PHILOSOPHY_PACK } from '../philosophy-pack.js';

type InquiryCreate = z.infer<typeof inquiryCreateSchema>;
type InquiryUpdate = z.infer<typeof inquiryUpdateSchema>;
type WritingCreate = z.infer<typeof inquiryWritingCreateSchema>;
// Retain the original operation fingerprint even after the reader edits their
// question. Retrying creation must not overwrite, or conflict with, those edits.
type StoredInquiry = Inquiry & { createFingerprint: string };

const collection = (uid: string, name: 'inquiries' | 'inquiryWritings' | 'notebook') =>
  adminDb.collection('users').doc(uid).collection(name);
const nowIso = () => new Date().toISOString();
const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };
const nodes = new Set(PHILOSOPHY_PACK.nodes.map((node) => node.id));
const readings = new Set(PHILOSOPHY_PACK.readings.map((reading) => reading.id));

function validId(id: unknown): id is string {
  // JS regex `$` can match before a final newline; reject every non-ID byte as
  // well as applying the shared length/shape contract before building paths.
  return typeof id === 'string' && inquiryIdSchema.safeParse(id).success && !/[^a-zA-Z0-9_-]/.test(id);
}

function checkIds(ids: (string | null)[]): void {
  if (ids.some((id) => id !== null && !validId(id))) fail(400, 'invalid inquiry or writing ID');
}

function checkNodes(ids: string[]): void {
  if (ids.some((id) => !nodes.has(id))) fail(400, 'unknown philosophy node');
}

function fingerprint(input: InquiryCreate): string {
  return createHash('sha256').update(JSON.stringify({
    id: input.id, question: input.question, readingId: input.readingId,
    parentId: input.parentId, nodeIds: input.nodeIds,
  })).digest('hex');
}

function publicInquiry(data: FirebaseFirestore.DocumentData): Inquiry {
  const { createFingerprint: _fingerprint, ...inquiry } = data as StoredInquiry;
  return inquiry;
}

const byUpdated = (a: Inquiry, b: Inquiry) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
const byCreated = (a: InquiryWriting, b: InquiryWriting) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
const validPathIds: RequestHandler = (req, res, next) => {
  if (Object.values(req.params).some((id) => !validId(id))) {
    res.status(400).json({ error: 'invalid inquiry or writing ID' });
    return;
  }
  next();
};

export function inquiriesRouter(deps: RouteDeps): Router {
  const r = Router();

  r.get('/philosophy', protectedRoute(deps, emptyBodySchema), (_req: AuthedRequest, res: Response) => {
    res.json(PHILOSOPHY_PACK);
  });

  r.get('/inquiries', protectedRoute(deps, emptyBodySchema), async (req: AuthedRequest, res: Response) => {
    const snap = await collection(req.auth!.uid, 'inquiries').get();
    res.json({ inquiries: snap.docs.map((doc) => publicInquiry(doc.data())).sort(byUpdated) });
  });

  r.post('/inquiries', protectedRoute(deps, inquiryCreateSchema), async (req: AuthedRequest, res: Response) => {
    const uid = req.auth!.uid;
    const input = req.body as InquiryCreate;
    checkIds([input.id, input.parentId, input.readingId, ...input.nodeIds]);
    checkNodes(input.nodeIds);
    if (input.readingId !== null && !readings.has(input.readingId)) fail(400, 'unknown philosophy reading');
    if (input.parentId === input.id) fail(400, 'an inquiry cannot be its own parent');
    const ref = collection(uid, 'inquiries').doc(input.id);
    const createFingerprint = fingerprint(input);
    const result = await adminDb.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (input.parentId !== null) {
        const parent = await tx.get(collection(uid, 'inquiries').doc(input.parentId));
        if (!parent.exists) fail(404, 'parent inquiry not found');
      }
      if (existing.exists) {
        const data = existing.data() as StoredInquiry;
        if (data.createFingerprint !== createFingerprint) fail(409, 'inquiry ID already used for different content');
        return { inquiry: publicInquiry(data), created: false };
      }
      // Parent links are create-only and must already exist. Together with the
      // self-link check, this prevents cycles, including concurrent creations.
      const now = nowIso();
      const inquiry: Inquiry = { ...input, status: 'active', revision: 0, createdAt: now, updatedAt: now };
      tx.create(ref, { ...inquiry, createFingerprint });
      return { inquiry, created: true };
    });
    res.status(result.created ? 201 : 200).json(result.inquiry);
  });

  r.get('/inquiries/:id', protectedRoute(deps, emptyBodySchema), validPathIds, async (req: AuthedRequest, res: Response) => {
    const uid = req.auth!.uid;
    const id = req.params.id as string;
    // One snapshot keeps the inquiry and its related records consistent. Queries
    // use one equality only; ordering in memory needs no composite index.
    const detail = await adminDb.runTransaction(async (tx): Promise<InquiryDetail> => {
      const inquiry = await tx.get(collection(uid, 'inquiries').doc(id));
      if (!inquiry.exists) fail(404, 'inquiry not found');
      const writings = await tx.get(collection(uid, 'inquiryWritings').where('inquiryId', '==', id));
      const branches = await tx.get(collection(uid, 'inquiries').where('parentId', '==', id));
      return {
        inquiry: publicInquiry(inquiry.data()!),
        writings: writings.docs.map((doc) => doc.data() as InquiryWriting).sort(byCreated),
        branches: branches.docs.map((doc) => publicInquiry(doc.data())).sort(byUpdated),
      };
    });
    res.json(detail);
  });

  r.post('/inquiries/:id', protectedRoute(deps, inquiryUpdateSchema), validPathIds, async (req: AuthedRequest, res: Response) => {
    const input = req.body as InquiryUpdate;
    if (input.nodeIds !== undefined) checkNodes(input.nodeIds);
    const ref = collection(req.auth!.uid, 'inquiries').doc(req.params.id as string);
    const inquiry = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) fail(404, 'inquiry not found');
      const existing = publicInquiry(snap.data()!);
      if (existing.revision !== input.revision) fail(409, 'inquiry changed; reload before saving');
      const updated: Inquiry = { ...existing, ...input, revision: existing.revision + 1, updatedAt: nowIso() };
      tx.update(ref, { ...updated });
      return updated;
    });
    res.json(inquiry);
  });

  r.post('/inquiries/:id/writings', protectedRoute(deps, inquiryWritingCreateSchema), validPathIds, async (req: AuthedRequest, res: Response) => {
    const uid = req.auth!.uid;
    const inquiryId = req.params.id as string;
    const input = req.body as WritingCreate;
    checkIds([input.id, input.revisesId, input.sourceNodeId]);
    if (input.sourceNodeId !== null) checkNodes([input.sourceNodeId]);
    if (input.revisesId === input.id) fail(400, 'a writing cannot revise itself');
    if (input.mode === 'revision' && input.revisesId === null) fail(400, 'a revision needs an earlier writing');
    const inquiryRef = collection(uid, 'inquiries').doc(inquiryId);
    const writingRef = collection(uid, 'inquiryWritings').doc(input.id);
    const result = await adminDb.runTransaction(async (tx) => {
      const inquiry = await tx.get(inquiryRef);
      if (!inquiry.exists) fail(404, 'inquiry not found');
      const snap = await tx.get(writingRef);
      if (input.revisesId !== null) {
        const previous = await tx.get(collection(uid, 'inquiryWritings').doc(input.revisesId));
        if (!previous.exists || previous.data()!.inquiryId !== inquiryId) fail(404, 'earlier writing not found');
      }
      if (snap.exists) {
        const existing = snap.data() as InquiryWriting;
        const { createdAt: _createdAt, ...content } = existing;
        if (!isDeepStrictEqual(content, { ...input, inquiryId })) fail(409, 'writing ID already used for different content');
        return { writing: existing, created: false };
      }
      const now = nowIso();
      const writing: InquiryWriting = { ...input, inquiryId, createdAt: now };
      tx.create(writingRef, writing);
      // Activity moves an inquiry up the list, without changing its editable
      // metadata revision. An identical retry performs neither write.
      tx.update(inquiryRef, { updatedAt: now });
      return { writing, created: true };
    });
    res.status(result.created ? 201 : 200).json(result.writing);
  });

  r.post('/inquiries/:id/writings/:writingId/notebook', protectedRoute(deps, emptyBodySchema), validPathIds, async (req: AuthedRequest, res: Response) => {
    const uid = req.auth!.uid;
    const inquiryId = req.params.id as string;
    const writingId = req.params.writingId as string;
    const entryId = await adminDb.runTransaction(async (tx) => {
      const inquiry = await tx.get(collection(uid, 'inquiries').doc(inquiryId));
      if (!inquiry.exists) fail(404, 'inquiry not found');
      const snap = await tx.get(collection(uid, 'inquiryWritings').doc(writingId));
      if (!snap.exists || snap.data()!.inquiryId !== inquiryId) fail(404, 'writing not found');
      const writing = snap.data() as InquiryWriting;
      if (!entryCreateSchema.safeParse({ bodyMd: writing.bodyMd }).success) {
        fail(400, 'Notebook copies are limited to 10 KB; the saved writing has not been changed');
      }
      const id = `inquiry-${writing.id}`;
      if (id.length > 128) fail(400, 'Notebook entry ID is too long');
      // Preserve the original save time, making the entire copy deterministic.
      // A client may edit/delete Notebook entries directly: never overwrite an
      // existing entry, even if only its metadata differs from the original.
      const entry: EntryDoc = { id, bodyMd: writing.bodyMd, createdAt: writing.createdAt };
      const ref = collection(uid, 'notebook').doc(id);
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (!isDeepStrictEqual(existing.data(), entry)) fail(409, 'Notebook entry already exists with different content');
      } else {
        tx.create(ref, entry);
      }
      return id;
    });
    res.json({ entryId });
  });

  return r;
}
