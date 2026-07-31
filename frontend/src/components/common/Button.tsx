import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  children?: ReactNode
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-400 disabled:hover:bg-primary-600',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-300 disabled:hover:bg-white',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400 disabled:hover:bg-red-600',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-400 disabled:hover:bg-emerald-600',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
