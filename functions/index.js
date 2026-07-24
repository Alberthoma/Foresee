// Foresee — Cloud Functions
// Notifica por correo (vía Gmail) cada vez que alguien deja su correo o
// responde la encuesta en la landing. GMAIL_USER/GMAIL_APP_PASSWORD son
// secretos (Secret Manager, ver README de esta carpeta) — nunca viven
// en el código ni en el repo.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const NOTIFY_TO = "albertomatosgil@gmail.com";

function buildTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER.value(), pass: GMAIL_APP_PASSWORD.value() },
  });
}

function formatFieldValue(value) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

exports.notifyNewLead = onDocumentCreated(
  { document: "landing_leads/{docId}", secrets: [GMAIL_USER, GMAIL_APP_PASSWORD] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const transporter = buildTransporter();
    await transporter.sendMail({
      from: `Foresee Landing <${GMAIL_USER.value()}>`,
      to: NOTIFY_TO,
      subject: "🎉 Nuevo interesado en Foresee",
      text: `Alguien dejó su correo en la landing.\n\nCorreo: ${data.email}\nFecha: ${new Date().toLocaleString("es")}`,
    });
  },
);

exports.notifyNewSurvey = onDocumentCreated(
  { document: "landing_survey/{docId}", secrets: [GMAIL_USER, GMAIL_APP_PASSWORD] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const transporter = buildTransporter();
    const lines = Object.entries(data)
      .filter(([key]) => key !== "createdAt")
      .map(([key, value]) => `${key}: ${formatFieldValue(value)}`)
      .join("\n");
    await transporter.sendMail({
      from: `Foresee Landing <${GMAIL_USER.value()}>`,
      to: NOTIFY_TO,
      subject: "📋 Nueva respuesta de encuesta — Foresee",
      text: lines || "(respuesta vacía)",
    });
  },
);
