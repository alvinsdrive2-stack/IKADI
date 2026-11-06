import * as React from "react"
import { useId } from "react"
import { TriangleAlert } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input as UiInput } from "@/components/ui/input"
import { Textarea as UiTextarea } from "@/components/ui/textarea"
import { Select as UiSelect } from "@/components/ui/select"
import { Checkbox as UiCheckbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

type Common = {
  label: string
  hint?: string
  error?: string
  required?: boolean
  ocrLow?: number
}

export const controlClass = "w-full"
export const controlState = (error?: string, ocrLow?: boolean) =>
  error || ocrLow ? "border-danger bg-danger-soft/40" : undefined

export function OcrHint({ id, confidence }: { id: string; confidence: number }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-danger">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      Hasil OCR {Math.round(confidence * 100)}% — periksa kembali data ini.
    </p>
  )
}

export function ErrorText({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm font-medium text-danger">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      {children}
    </p>
  )
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  ocrLow,
  children,
}: Common & { id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-primary" aria-hidden>
            *
          </span>
        )}
      </Label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {children}
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
      {ocrLow !== undefined && <OcrHint id={`${id}-ocr`} confidence={ocrLow} />}
    </div>
  )
}

const describedBy = (id: string, hint?: string, error?: string, ocrLow?: number) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null, ocrLow !== undefined ? `${id}-ocr` : null]
    .filter(Boolean)
    .join(" ") || undefined

export function Input({
  label,
  hint,
  error,
  required,
  ocrLow,
  ...props
}: Common & React.InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId()
  const id = props.id ?? autoId
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} ocrLow={ocrLow}>
      <UiInput
        {...props}
        id={id}
        aria-required={required || undefined}
        aria-invalid={error || ocrLow !== undefined ? true : undefined}
        aria-describedby={describedBy(id, hint, error, ocrLow)}
        className={controlState(error, ocrLow !== undefined)}
      />
    </Field>
  )
}

export function Textarea({
  label,
  hint,
  error,
  required,
  ocrLow,
  ...props
}: Common & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId()
  const id = props.id ?? autoId
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} ocrLow={ocrLow}>
      <UiTextarea
        {...props}
        id={id}
        aria-required={required || undefined}
        aria-invalid={error || ocrLow !== undefined ? true : undefined}
        aria-describedby={describedBy(id, hint, error, ocrLow)}
        className={controlState(error, ocrLow !== undefined)}
      />
    </Field>
  )
}

export function Select({
  label,
  hint,
  error,
  required,
  ocrLow,
  options,
  ...props
}: Common &
  React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: { value: string; label: string; disabled?: boolean }[]
  }) {
  const autoId = useId()
  const id = props.id ?? autoId
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} ocrLow={ocrLow}>
      <UiSelect
        {...props}
        id={id}
        aria-required={required || undefined}
        aria-invalid={error || ocrLow !== undefined ? true : undefined}
        aria-describedby={describedBy(id, hint, error, ocrLow)}
        className={controlState(error, ocrLow !== undefined)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </UiSelect>
    </Field>
  )
}

export function RadioGroup({
  label,
  error,
  required,
  ocrLow,
  name,
  options,
  value,
  onChange,
  columns,
  controlsId,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  ocrLow?: number
  name: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  columns: 1 | 2
  controlsId?: string
}) {
  const uid = useId()
  const errorId = `${name}-${uid}-error`
  const ocrId = `${name}-${uid}-ocr`
  return (
    <fieldset
      aria-required={required || undefined}
      aria-invalid={error || ocrLow !== undefined ? true : undefined}
      aria-describedby={[error ? errorId : null, ocrLow !== undefined ? ocrId : null].filter(Boolean).join(" ") || undefined}
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
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {options.map((o) => {
          const checked = value === o.value
          return (
            <label
              key={o.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-[4px] border bg-surface px-3 text-base text-ink has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus",
                ocrLow !== undefined
                  ? "border-danger bg-danger-soft/40"
                  : checked
                    ? "border-primary bg-primary-soft"
                    : "border-control-border"
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                required={required}
                className="size-4 shrink-0 appearance-none rounded-[3px] border border-control-border bg-surface checked:border-primary checked:bg-primary"
              />
              <span>{o.label}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <div className="mt-1.5">
          <ErrorText id={errorId}>{error}</ErrorText>
        </div>
      )}
      {ocrLow !== undefined && (
        <div className="mt-1.5">
          <OcrHint id={ocrId} confidence={ocrLow} />
        </div>
      )}
    </fieldset>
  )
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
  id: string
  label: React.ReactNode
  error?: string
  checked: boolean
  onChange: (checked: boolean) => void
  onBlur?: () => void
  name?: string
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-11 cursor-pointer items-start gap-3 rounded-[4px] border bg-surface p-4 text-sm text-ink",
          error ? "border-danger" : "border-control-border"
        )}
      >
        <UiCheckbox
          id={id}
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5"
        />
        <span>{label}</span>
      </label>
      {error && <ErrorText id={`${id}-error`}>{error}</ErrorText>}
    </div>
  )
}
