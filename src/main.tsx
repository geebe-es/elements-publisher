import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Tempo mínimo de exibição da tela de loading (splash) — evita "flash" rápido
const MIN_SPLASH_MS = 1400;
const splashStart = performance.now();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

(() => {
  const el = document.getElementById("splash-root");
  if (!el) return;
  const wait = Math.max(0, MIN_SPLASH_MS - (performance.now() - splashStart));
  setTimeout(() => {
    el.style.transition = "opacity .35s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 380);
  }, wait);
})();

