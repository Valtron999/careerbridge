export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[440px] px-5 py-14">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
      {footer && <p className="mt-6 text-sm text-ink-muted">{footer}</p>}
    </div>
  );
}
