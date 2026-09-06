// All model output and user markdown renders through marked + DOMPurify.
// Raw innerHTML with model output is banned — this module is the only door.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['p', 'br', 'em', 'strong', 'ul', 'ol', 'li', 'blockquote', 'h3', 'h4', 'hr', 'a', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });
}
