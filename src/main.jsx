import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './hooks/useTheme'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: 'white', zIndex: 9999, position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'auto' }}>
          <h1>React Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error && this.state.error.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.info && this.state.info.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
