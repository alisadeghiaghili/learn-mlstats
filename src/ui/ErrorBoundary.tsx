/**
 * Error boundary: replace a white screen with the actual runtime error.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryState {
  /** Captured error message. */
  message: string;
  /** Captured stack, if any. */
  stack: string;
}

/**
 * Catch React render errors and show them in the page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: "", stack: "" };

  /**
   * Derive state from a thrown error.
   *
   * @param error - Render error.
   * @returns Next state.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { message: error.message, stack: error.stack ?? "" };
  }

  /**
   * Log the error for debugging.
   *
   * @param error - Render error.
   * @param info - Component stack.
   */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("learn-mlstats crashed:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.message) {
      return (
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            padding: 24,
            background: "#1c1f26",
            color: "#ff8f80",
            minHeight: "100vh",
            whiteSpace: "pre-wrap",
          }}
        >
          <strong>Runtime error</strong>
          {"\n\n"}
          {this.state.message}
          {"\n\n"}
          {this.state.stack}
        </div>
      );
    }
    return this.props.children;
  }
}
