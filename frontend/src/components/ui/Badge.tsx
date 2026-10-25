type Variant = 'green' | 'red' | 'gray' | 'teal' | 'amber' | 'violet'

const styles: Record<Variant, string> = {
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  gray:   'bg-gray-100 text-gray-600',
  teal:   'bg-teal-100 text-teal-700',
  amber:  'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
}

export function Badge({ label, variant }: { label: string; variant: Variant }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]}`}>
      {label}
    </span>
  )
}
