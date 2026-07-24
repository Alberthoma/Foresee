const sgMail = require("@sendgrid/mail");
const { defineSecret, defineString } = require("firebase-functions/params");

const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
// No es secreta — es la dirección "from" ya verificada en SendGrid (Single
// Sender Verification). Configurable por si se cambia más adelante.
const SENDGRID_FROM_EMAIL = defineString("SENDGRID_FROM_EMAIL", {
  default: "albertomatosgil@gmail.com",
});

let configured = false;
function ensureConfigured() {
  if (configured) return;
  sgMail.setApiKey(SENDGRID_API_KEY.value());
  configured = true;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(amount) || 0,
  );
}

function dayLabelFor(threshold) {
  return threshold === 0 ? "hoy" : threshold === 1 ? "mañana" : `en ${threshold} días`;
}

async function sendEmail({ toEmail, subject, html }) {
  ensureConfigured();
  await sgMail.send({
    to: toEmail,
    from: { email: SENDGRID_FROM_EMAIL.value(), name: "Foresee" },
    subject,
    html,
  });
}

function buildReminderEmail({ description, amount, dueDateISO, threshold }) {
  const dayLabel = dayLabelFor(threshold);
  const subject =
    threshold === 0
      ? `Hoy vence: ${description}`
      : `Recordatorio: "${description}" vence ${dayLabel}`;
  const html = `
    <p>Hola,</p>
    <p>Tu gasto recurrente <strong>${escapeHtml(description)}</strong> vence ${dayLabel} (${dueDateISO}).</p>
    <p>Monto: <strong>${escapeHtml(formatCurrency(amount))}</strong></p>
    <p>— Foresee</p>
  `;
  return { subject, html };
}

// Tarjetas y préstamos (agregado 2026-07-24) — mismo canal, distinto
// contenido: menciona el banco/tarjeta y el pago mensual estimado (misma
// fórmula de amortización que usa la app, ver src/creditCardReminders.js).
function buildCardReminderEmail({ bank, monthlyPayment, dueDateISO, threshold }) {
  const dayLabel = dayLabelFor(threshold);
  const subject =
    threshold === 0
      ? `Hoy vence el pago de tu tarjeta "${bank}"`
      : `Recordatorio: pago de "${bank}" vence ${dayLabel}`;
  const html = `
    <p>Hola,</p>
    <p>El pago de tu tarjeta/préstamo <strong>${escapeHtml(bank)}</strong> vence ${dayLabel} (${dueDateISO}).</p>
    <p>Pago mensual estimado: <strong>${escapeHtml(formatCurrency(monthlyPayment))}</strong></p>
    <p>— Foresee</p>
  `;
  return { subject, html };
}

async function sendReminderEmail({ toEmail, description, amount, dueDateISO, threshold }) {
  const { subject, html } = buildReminderEmail({ description, amount, dueDateISO, threshold });
  await sendEmail({ toEmail, subject, html });
}

async function sendCardReminderEmail({ toEmail, bank, monthlyPayment, dueDateISO, threshold }) {
  const { subject, html } = buildCardReminderEmail({ bank, monthlyPayment, dueDateISO, threshold });
  await sendEmail({ toEmail, subject, html });
}

module.exports = {
  sendReminderEmail,
  sendCardReminderEmail,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
};
