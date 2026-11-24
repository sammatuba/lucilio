import { inquiryIdSchema } from '../../shared/inquiry';

export function linkedInquiry(params: URLSearchParams) {
  return inquiryIdSchema.safeParse(params.get('inquiry')).data;
}

// Carry only the identifiers needed to reopen the inquiry and map entry.
export function libraryHref(path: string, inquiry?: string, node?: string) {
  const params = new URLSearchParams();
  if (inquiry) params.set('inquiry', inquiry);
  if (node) params.set('node', node);
  return params.size ? `${path}?${params}` : path;
}

export function returnToInquiry(id: string, node?: string) {
  // "node" on an inquiry is reserved for an explicit connection suggestion.
  const path = `/inquiry/${encodeURIComponent(id)}`;
  return node ? `${path}?${new URLSearchParams({ mapNode: node })}` : path;
}
