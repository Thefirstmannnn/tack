import { htmlToText, renderMarkdownWithHeadingIds, summarize } from '@tack/services/markdown';
import { isHtmlDoc } from '@tack/shared/constants';
import { truncate } from '@tack/shared/utils';

export function renderedDocHtml(kind: string | null | undefined, content: string): string {
  return isHtmlDoc(kind) ? '' : renderMarkdownWithHeadingIds(content);
}

export function summarizeDoc(
  kind: string | null | undefined,
  content: string,
  maxChars: number,
): string {
  if (!isHtmlDoc(kind)) return summarize(content, maxChars);
  return truncate(htmlToText(content).replace(/\s+/g, ' ').trim(), maxChars);
}
