import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[200px] flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-1">오류가 발생했습니다</h3>
              <p className="text-xs text-slate-500">
                {this.state.error?.message || '예기치 않은 오류가 발생했습니다.'}
              </p>
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-dark-600/50 border border-dark-600 hover:border-accent/30 text-slate-300 transition-all inline-flex items-center gap-2"
            >
              <RefreshCw size={12} />
              다시 시도
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
