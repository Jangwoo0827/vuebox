import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './StateViews'

interface Props {
  children: ReactNode
  /** Rendered instead of the section when it crashes (defaults to an inline error). */
  fallback?: ReactNode
  /** Changing this resets the boundary (e.g. the route path). */
  resetKey?: unknown
}

interface State {
  error: Error | null
}

/** Keeps one broken section from taking down the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div>
        <ErrorState title="이 영역을 표시하지 못했습니다" message="새로고침하면 해결될 수 있습니다." onRetry={() => this.setState({ error: null })} compact />
        <details className="mx-auto mt-2 max-w-xl text-center text-xs text-text-secondary">
          <summary className="cursor-pointer">오류 내용 보기</summary>
          <p className="mt-2 break-words rounded-lg bg-surface-2 p-3 text-left font-mono">{`${error.name}: ${error.message}`.slice(0, 400)}</p>
        </details>
      </div>
    )
  }
}
