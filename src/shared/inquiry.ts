import { z } from 'zod';
import { byteLength } from './schemas.js';

export const inquiryIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const writingModes = ['reflection', 'argument', 'revision', 'question'] as const;
export const inquiryCreateSchema = z.object({
  id: inquiryIdSchema,
  question: z.string().trim().min(1).max(300),
  readingId: inquiryIdSchema.nullable().default(null),
  parentId: inquiryIdSchema.nullable().default(null),
  nodeIds: z.array(inquiryIdSchema).max(24).default([]),
}).strict();
export const inquiryUpdateSchema = z.object({
  question: z.string().trim().min(1).max(300).optional(),
  status: z.enum(['active', 'paused', 'resting']).optional(),
  nodeIds: z.array(inquiryIdSchema).max(24).optional(),
  revision: z.number().int().nonnegative(),
}).strict();
export const inquiryDocSchema = inquiryCreateSchema.extend({
  status: z.enum(['active', 'paused', 'resting']),
  revision: z.number().int().nonnegative(), createdAt: z.string(), updatedAt: z.string(),
});
export const inquiryWritingCreateSchema = z.object({
  id: inquiryIdSchema,
  bodyMd: z.string().trim().min(1).refine((text) => byteLength(text) <= 20 * 1024, 'Writing is limited to 20 KB'),
  mode: z.enum(writingModes),
  revisesId: inquiryIdSchema.nullable().default(null),
  sourceNodeId: inquiryIdSchema.nullable().default(null),
}).strict();
export const inquiryWritingSchema = inquiryWritingCreateSchema.extend({ inquiryId: inquiryIdSchema, createdAt: z.string() });
export const inquiryDetailSchema = z.object({
  inquiry: inquiryDocSchema, writings: z.array(inquiryWritingSchema), branches: z.array(inquiryDocSchema),
});
export type Inquiry = z.infer<typeof inquiryDocSchema>;
export type InquiryWriting = z.infer<typeof inquiryWritingSchema>;
export type InquiryDetail = z.infer<typeof inquiryDetailSchema>;
export type WritingMode = (typeof writingModes)[number];
