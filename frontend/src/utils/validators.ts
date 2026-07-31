import { isValidEntityName, isValidIri } from './helpers'

export interface ValidationResult {
  ok: boolean
  /** 错误信息（ok 为 false 时非空） */
  message?: string
}

/** 校验类节点表单 */
export function validateClassForm(values: {
  name: string
  label?: string
  comment?: string
  ontologyIri: string
  duplicateCheck?: boolean
}): ValidationResult {
  if (!values.name.trim()) return { ok: false, message: '类名不能为空' }
  if (!isValidEntityName(values.name.trim()))
    return { ok: false, message: '类名不能包含空格及 < > { } | \\ ^ ` 等保留字符' }
  if (values.label && values.label.trim().length > 100)
    return { ok: false, message: '显示名长度不能超过 100 个字符' }
  if (!isValidIri(values.ontologyIri)) return { ok: false, message: '本体命名空间 IRI 不合法' }
  if (values.duplicateCheck) return { ok: true }
  return { ok: true }
}

/** 校验属性表单 */
export function validatePropertyForm(values: {
  name: string
  label?: string
  comment?: string
  source: string
  target: string
}): ValidationResult {
  if (!values.name.trim()) return { ok: false, message: '属性名不能为空' }
  if (!isValidEntityName(values.name.trim()))
    return { ok: false, message: '属性名不能包含空格及 < > { } | \\ ^ ` 等保留字符' }
  if (!values.source) return { ok: false, message: '请选择属性的定义域（domain）' }
  if (!values.target) return { ok: false, message: '请选择属性的值域（range）' }
  if (values.source === values.target) return { ok: false, message: '定义域与值域不能是同一个实体' }
  if (values.label && values.label.trim().length > 100)
    return { ok: false, message: '显示名长度不能超过 100 个字符' }
  return { ok: true }
}

/** 校验项目表单 */
export function validateProjectForm(values: {
  name: string
  description?: string
  ontologyIri?: string
}): ValidationResult {
  if (!values.name.trim()) return { ok: false, message: '项目名称不能为空' }
  if (values.name.trim().length > 60) return { ok: false, message: '项目名称长度不能超过 60 个字符' }
  if (values.ontologyIri && !isValidIri(values.ontologyIri))
    return { ok: false, message: '本体命名空间 IRI 不合法' }
  return { ok: true }
}
