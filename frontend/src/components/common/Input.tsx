import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { LabelWithTip } from './Tooltip'

interface FieldWrapProps {
  label: string
  /** 标签上的名词/操作解释（鼠标悬浮气泡） */
  labelTip?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

/** 表单字段外壳：标签（可带解释气泡）+ 控件 + 提示/错误 */
export function Field({ label, labelTip, hint, error, required, children }: FieldWrapProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        <LabelWithTip label={label} tip={labelTip} />
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  )
}

const baseInputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  labelTip?: string
  hint?: string
  error?: string
  required?: boolean
}

/** 带标签的单行输入框 */
export default function Input({ label, labelTip, hint, error, required, className = '', ...rest }: InputProps) {
  return (
    <Field label={label} labelTip={labelTip} hint={hint} error={error} required={required}>
      <input className={`${baseInputClass} ${className}`} {...rest} />
    </Field>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  labelTip?: string
  hint?: string
  error?: string
  required?: boolean
}

/** 带标签的多行文本域 */
export function Textarea({ label, labelTip, hint, error, required, className = '', ...rest }: TextareaProps) {
  return (
    <Field label={label} labelTip={labelTip} hint={hint} error={error} required={required}>
      <textarea className={`${baseInputClass} resize-y ${className}`} {...rest} />
    </Field>
  )
}
