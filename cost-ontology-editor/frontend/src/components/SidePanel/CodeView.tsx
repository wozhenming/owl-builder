import { useMemo, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import Button from '../common/Button'
import { useOntologyStore } from '../../store/ontologyStore'
import { useUiStore } from '../../store/uiStore'
import { generateOwlXml } from '../../services/owlGenerator'
import { downloadTextFile } from '../../services/fileService'

/** 源码视图：实时预览生成的 OWL RDF/XML */
export default function CodeView() {
  const ontology = useOntologyStore((s) => s.ontology)
  const showToast = useUiStore((s) => s.showToast)
  const [copied, setCopied] = useState(false)

  const xml = useMemo(() => generateOwlXml(ontology), [ontology])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(xml)
      setCopied(true)
      showToast('已复制到剪贴板', 'success')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast('复制失败，请手动选择复制', 'error')
    }
  }

  return (
    <div className="flex h-full flex-col space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">标准 OWL RDF/XML 预览（实时生成）</p>
        <div className="flex gap-2">
          <Button size="sm" variant={copied ? 'success' : 'secondary'} icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copy}>
            {copied ? '已复制' : '复制'}
          </Button>
          <Button
            size="sm"
            icon={<Download size={13} />}
            onClick={() => {
              downloadTextFile(xml, `${ontology.name}.owl`, 'application/rdf+xml')
              showToast('已导出 .owl 文件', 'success')
            }}
          >
            下载
          </Button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200">
        <code>{xml}</code>
      </pre>
      <p className="text-xs text-slate-400">
        该视图为只读预览。如需编辑 XML，请导出文件后在外部工具中修改，再通过「导入」加载。
      </p>
    </div>
  )
}
