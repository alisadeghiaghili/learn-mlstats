/**
 * React DOM entrypoint.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ErrorBoundary } from "./ui/ErrorBoundary.js";
import "./styles.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (err) {
  const message = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
  rootEl.innerHTML = `<pre style="font-family:ui-monospace,monospace;padding:24px;background:#1c1f26;color:#ff8f80;white-space:pre-wrap;min-height:100vh;box-sizing:border-box;margin:0">Boot error\n\n${message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;
}
