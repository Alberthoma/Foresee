// Foresee 2.0 — notifications.js
// Notificación nativa del navegador — compartida por el motor de
// recurrentes y las alertas de presupuesto (antes cada uno tenía su
// propia copia de esta misma función).
import { appState } from "../state.js";

export function sendBrowserNotification(title, body) {
  if (!appState.notificationsEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch (err) {
    console.error("[Notification]", err);
  }
}
