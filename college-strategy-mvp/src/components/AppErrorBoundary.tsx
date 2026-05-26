import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Chrome 整页翻译会改写 DOM，React 对账失败时用它代替整页白屏。
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[app] render_error", error, info.componentStack);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app-error-fallback" role="alert">
        <h1>页面暂时无法显示</h1>
        <p>
          若刚使用了浏览器的「翻译此页」，请刷新后改用右上角 <strong>EN</strong> 切换英文界面（不要用 Chrome
          翻译）。
        </p>
        <p className="app-error-fallback__en">
          If you used Chrome Translate, refresh and switch to <strong>EN</strong> in the header instead.
        </p>
        <div className="app-error-fallback__actions">
          <button type="button" className="btn btn-primary" onClick={this.handleReload}>
            刷新页面
          </button>
          <button type="button" className="btn btn-secondary" onClick={this.handleRetry}>
            重试
          </button>
        </div>
      </div>
    );
  }
}
