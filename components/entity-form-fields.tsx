import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  name: string;
  error?: string[];
};

const inputClass = "h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function FormInput({ label, name, error, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input name={name} className={`${inputClass} mt-1.5`} aria-invalid={Boolean(error)} {...props} />{error?.[0] ? <span className="mt-1 block text-xs text-red-600">{error[0]}</span> : null}</label>;
}

export function FormSelect({ label, name, error, children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return <label className="block text-sm font-medium text-slate-700">{label}<select name={name} className={`${inputClass} mt-1.5`} aria-invalid={Boolean(error)} {...props}>{children}</select>{error?.[0] ? <span className="mt-1 block text-xs text-red-600">{error[0]}</span> : null}</label>;
}

export function FormTextarea({ label, name, error, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <label className="block text-sm font-medium text-slate-700">{label}<textarea name={name} className="mt-1.5 min-h-24 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" aria-invalid={Boolean(error)} {...props} />{error?.[0] ? <span className="mt-1 block text-xs text-red-600">{error[0]}</span> : null}</label>;
}
