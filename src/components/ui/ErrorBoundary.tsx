import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './StateViews'

interface Props {
  children: ReactNode
  /** Rendered instead of the section when it crashes (defaults to an inline error). */
  fallback?: ReactNode
  /** Changing this resets the boundary (e.g. the route path). */
  resetKey?: unknown
}

/** Keeps one broken section from taking down the whole app. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return this.props.fallback ?? <ErrorState title="이 영역을 표시하지 못했습니다" message="새로고침하면 해결될 수 있습니다." onRetry={() => this.setState({ failed: false })} compact />
  }
}
