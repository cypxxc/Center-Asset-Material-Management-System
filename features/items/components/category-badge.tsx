import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CategoryBadgeProps {
  name: string
  color?: string | null
  className?: string
}

export function CategoryBadge({ name, color, className }: CategoryBadgeProps) {
  const safeColor = color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#64748B'

  return (
    <span
      title={name}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs border max-w-full min-w-0 transition-colors',
        className
      )}
      style={{
        backgroundColor: `${safeColor}1A`,
        borderColor: `${safeColor}4D`,
      }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: safeColor }}
        aria-hidden="true"
      />
      <Tag
        className="w-3 h-3 shrink-0"
        style={{ color: `color-mix(in oklab, ${safeColor} 75%, var(--foreground))` }}
        aria-hidden="true"
      />
      <span className="truncate text-foreground font-medium">{name}</span>
    </span>
  )
}
