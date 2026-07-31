import type { ReactNode, SelectHTMLAttributes } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  options: SelectOption[]
  /** 自定义渲染选项内容（用于带说明的选项） */
  renderOption?: (option: SelectOption) => ReactNode
}

export default function Select({
  label,
  hint,
  options,
  renderOption,
  className = '',
  ...rest
}: SelectProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <select
        className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${className}`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {renderOption ? renderOption(o) : o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
