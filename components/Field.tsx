"use client";

import { useId } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type Common = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

/** Kelas kontrol: border control-border 4.6:1, state error tetap merah + latar lembut. */
export const controlClass =
  "w-full rounded-md border bg-surface text-base text-ink transition-colors hover:border-ink-muted focus:border-primary focus:outline-none disabled:bg-bg";

export const controlState = (error?: string) =>
  error ? "border-danger bg-danger-soft/40" : "border-control-border";

export function ErrorText({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-danger">
      <svg
        aria-hidden
        className="mt-0.5 size-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" strokeLinecap="round" />
      </svg>
      {children}
    </p>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: Common & { id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-primary" aria-hidden>
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {children}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  );
}

const describedBy = (id: string, hint?: string, error?: string) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ") || undefined;

export function Input({
  label,
  hint,
  error,
  required,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <input
        {...props}
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`h-11 ${controlClass} px-3 ${controlState(error)}`}
      />
    </Field>
  );
}

export function Textarea({
  label,
  hint,
  error,
  required,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        {...props}
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`min-h-28 resize-y px-3 py-2.5 ${controlClass} ${controlState(error)}`}
      />
    </Field>
  );
}

const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%234B5563' stroke-width='2'%3E%3Cpath d='m5 8 5 5 5-5'/%3E%3C/svg%3E\")] bg-[position:right_0.75rem_center] bg-no-repeat pr-10";

export function Select({
  label,
  hint,
  error,
  required,
  options,
  ...props
}: Common &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string; disabled?: boolean }[];
  }) {
  const autoId = useId();
  const id = props.id ?? autoId;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <select
        {...props}
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`h-11 appearance-none ${chevron} ${controlClass} pl-3 ${controlState(error)}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function RadioGroup({
  label,
  error,
  required,
  name,
  options,
  value,
  onChange,
  columns,
  controlsId,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  /** 2 = sejajar (opsi pendek); 1 = vertikal (opsi panjang / 3+). */
  columns: 1 | 2;
  controlsId?: string;
}) {
  const uid = useId();
  const errorId = `${name}-${uid}-error`;
  return (
    <fieldset
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      aria-controls={controlsId}
      className="min-w-0"
    >
      <legend className="mb-2 text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-primary" aria-hidden>
            *
          </span>
        )}
      </legend>
      <div className={`grid gap-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-control-border bg-surface px-3 text-base text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              required={required}
              className="size-4 shrink-0 accent-primary"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <div className="mt-1.5">
          <ErrorText id={errorId}>{error}</ErrorText>
        </div>
      )}
    </fieldset>
  );
}

export function Checkbox({
  id,
  label,
  error,
  checked,
  onChange,
  onBlur,
  name,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onBlur?: () => void;
  name?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-surface p-4 text-sm text-ink ${
          error ? "border-danger" : "border-control-border"
        }`}
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>{label}</span>
      </label>
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  );
}
