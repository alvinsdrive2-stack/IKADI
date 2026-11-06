import { Card as UiCard, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function Card({
  title,
  description,
  headerAction,
  className = "",
  children,
}: {
  title?: string
  description?: string
  headerAction?: React.ReactNode
  main?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <UiCard className={className}>
      {(title || headerAction) && (
        <CardHeader>
          <div className="min-w-0">
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {headerAction}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </UiCard>
  )
}
