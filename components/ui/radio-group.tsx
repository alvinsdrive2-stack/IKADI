import * as React from "react"
import { cn } from "@/lib/utils"

const RadioGroupContext = React.createContext<{ name: string; value: string; onChange: (v: string) => void } | null>(null)

function RadioGroup({
  name,
  value,
  onChange,
  children,
  className,
}: {
  name: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onChange }}>
      <div role="radiogroup" className={cn("grid gap-2", className)}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

function RadioGroupItem({
  value: itemValue,
  id,
  children,
}: {
  value: string
  id?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(RadioGroupContext)
  if (!ctx) return null
  const checked = ctx.value === itemValue
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-[4px] border bg-surface px-3 text-base text-ink has-+input:peer-focus-visible:outline has-+input:peer-focus-visible:outline-2 has-+input:peer-focus-visible:outline-offset-2 has-+input:peer-focus-visible:outline-focus",
        checked ? "border-primary bg-primary-soft" : "border-control-border"
      )}
    >
      <input
        id={id}
        type="radio"
        name={ctx.name}
        value={itemValue}
        checked={checked}
        onChange={() => ctx.onChange(itemValue)}
        className="peer size-4 shrink-0 appearance-none rounded-[3px] border border-control-border bg-surface checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <span>{children}</span>
    </label>
  )
}

export { RadioGroup, RadioGroupItem }
