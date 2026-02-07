import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";


import App from './App';
import './i18n'; // Import i18n config
import "./App.css";

console.log('[Main] Topoo Gateway initializing...');

// 全局错误捕获
window.onerror = (msg, _url, line, col, error) => {
  const errorMsg = `[Frontend Error] ${msg} at ${line}:${col}`;
  console.error(errorMsg, error);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="color: red; padding: 20px; background: white;">
      <h2>Frontend Crash</h2>
      <p>${errorMsg}</p>
      <pre>${error?.stack || ''}</pre>
    </div>`;
  }
  invoke("log_error", { message: errorMsg }).catch(() => { });
};

// 启动时显式调用 Rust 命令显示窗口
invoke("show_main_window").catch(console.error);

const rootElement = document.getElementById("root");
if (rootElement) {
  rootElement.innerHTML = '<div style="color: white; padding: 20px;">[Main] Root element found, activating React...</div>';
}

ReactDOM.createRoot(rootElement as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
