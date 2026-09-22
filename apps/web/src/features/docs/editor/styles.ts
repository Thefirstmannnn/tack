import { cn } from '@/lib/cn.ts';

const placeholder = cn(
  '[&_.ProseMirror_p.is-empty:first-child]:before:pointer-events-none',
  '[&_.ProseMirror_p.is-empty:first-child]:before:float-left',
  '[&_.ProseMirror_p.is-empty:first-child]:before:h-0',
  '[&_.ProseMirror_p.is-empty:first-child]:before:text-faint',
  '[&_.ProseMirror_p.is-empty:first-child]:before:content-[attr(data-placeholder)]',
);

const callout = cn(
  '[&_blockquote[data-callout]]:my-4 [&_blockquote[data-callout]]:rounded-lg',
  '[&_blockquote[data-callout]]:border [&_blockquote[data-callout]]:border-l-2',
  '[&_blockquote[data-callout]]:bg-surface-2 [&_blockquote[data-callout]]:px-4 [&_blockquote[data-callout]]:py-3',
  '[&_blockquote[data-callout=note]]:border-l-accent',
  '[&_blockquote[data-callout=tip]]:border-l-success',
  '[&_blockquote[data-callout=warning]]:border-l-warning',
  '[&_blockquote[data-callout=danger]]:border-l-danger',
  '[&_blockquote[data-callout]>p]:my-1',
);

const toggle = cn(
  '[&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details]:border-border',
  '[&_details]:bg-surface [&_details]:px-3 [&_details]:py-2',
  '[&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-text',
  '[&_summary]:marker:text-faint',
);

const commentAnchor = cn(
  '[&_.tack-doc-anchor]:cursor-pointer [&_.tack-doc-anchor]:rounded-[0.2em]',
  '[&_.tack-doc-anchor]:bg-warning/20 [&_.tack-doc-anchor]:px-0.5',
  '[&_.tack-doc-anchor]:border-warning/50 [&_.tack-doc-anchor]:border-b',
  '[&_.tack-doc-anchor]:transition-colors [&_.tack-doc-anchor]:duration-[var(--duration-fast)]',
  '[&_.tack-doc-anchor]:ease-[var(--ease-standard)]',
  '[&_.tack-doc-anchor:hover]:bg-warning/35',
  '[&_.tack-doc-anchor-active]:bg-warning/45',
);

export const editorSurfaceClassName = cn(
  '[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:outline-none',
  '[&_.ProseMirror]:focus-visible:outline-none',
  '[&_.ProseMirror_.tableWrapper]:overflow-x-auto',
  '[&_.ProseMirror_.selectedCell]:bg-accent-soft',
  '[&_.ProseMirror-selectednode]:outline [&_.ProseMirror-selectednode]:outline-accent',
  placeholder,
  callout,
  toggle,
  commentAnchor,
);
