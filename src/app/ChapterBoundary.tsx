import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Keeps one failing chapter from taking down the page. A failed chunk load
 * (flaky network, new deployment) gets a retry; anything else is reported.
 */
export class ChapterBoundary extends Component<{ id: string; title: string; children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Chapter "${this.props.id}" failed`, error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <section id={this.props.id} data-chapter={this.props.id} className="page-x flex min-h-[60svh] flex-col justify-center gap-4 py-24">
        <h2 className="semi-wide text-2xl text-fg">{this.props.title} could not load.</h2>
        <p className="max-w-[40rem] text-muted">The simulation code did not arrive. Check the connection, then try again.</p>
        <div>
          <button type="button" onClick={() => location.reload()} className="rounded-md bg-fg px-4 py-2 text-sm text-void">
            Reload the page
          </button>
        </div>
      </section>
    )
  }
}
