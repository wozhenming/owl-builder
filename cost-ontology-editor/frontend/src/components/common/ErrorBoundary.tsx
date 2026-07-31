import { Component, type ErrorInfo, type ReactNode } from 'react'
import Button from './Button'

interface Props {
  children: ReactNode
  /** 发生错误时的自定义标题 */
  title?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  message: string
}

/**
 * 错误边界：捕获渲染期异常，显示可读错误信息并提供恢复按钮，
 * 避免「白屏」无法定位问题。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, message: '' })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8">
        <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-red-700">
            {this.props.title ?? '页面出错了'}
          </h2>
          <p className="mt-2 break-all text-sm text-slate-600">
            {this.state.message || '发生了未知错误，请刷新页面重试'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            建议按 F12 打开开发者工具查看控制台中的详细错误信息，并反馈给开发者。
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
            <Button variant="secondary" onClick={this.reset}>
              重试渲染
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
