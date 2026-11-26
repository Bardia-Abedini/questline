import { cx } from './cx';

export function Spinner({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" className={cx('inline-flex items-center gap-2 text-muted', className)}>
      <span
        aria-hidden
        className="inline-block size-5 animate-spin rounded-full border-[3px] border-primary/30 border-t-primary"
      />
      <span className="ql-visually-hidden">{label}</span>
    </span>
  );
}
