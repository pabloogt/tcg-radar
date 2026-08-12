import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: { label: string; href: string };
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 py-12 text-center">
      <span className="mb-4 grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75"><path d="M12 8v8M8 12h8" /><circle cx="12" cy="12" r="9" /></svg>
      </span>
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <Link href={action.href} className="mt-5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">{action.label}</Link> : null}
    </section>
  );
}
