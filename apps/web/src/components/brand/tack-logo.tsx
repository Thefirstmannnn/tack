import { cn } from '@/lib/cn.ts';

export function TackMark({ size = 20, className }: { size?: number; className?: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: fixed-size static brand mark, not routed through the next/image optimizer
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={cn('shrink-0 select-none', className)}
    />
  );
}

export function TackWordmark({
  compact = false,
  size = 20,
  className,
}: {
  compact?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <TackMark size={size} />
      {compact ? null : <span className="text-base font-semibold tracking-tight">Tack</span>}
    </span>
  );
}
