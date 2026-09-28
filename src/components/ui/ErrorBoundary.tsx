import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { failed: boolean };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) { void error; void info; }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page-stack">
        <div className="empty-state">
          <b>Something went wrong</b>
          <span>This page hit an unexpected error. Reloading usually fixes it.</span>
          <button className="secondary-button" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
  }
}
