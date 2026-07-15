// Foresee 2.0 — utils.js
// Helpers puros (sin DOM). Se amplía fase por fase, solo con lo que
// cada fase realmente usa — evita el código huérfano del origen.

export function formatCurrency(amount, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount || 0);
}

export function roundMoney(x) {
  return Math.round(x * 100) / 100;
}

export function getCurrentMonthStr() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function formatMonthLabel(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-");
  return `${MONTHS_ES[parseInt(m, 10) - 1]} ${y}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function toTitleCase(str) {
  if (!str) return "";
  return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Dos descripciones "comparten palabra" si tienen en común al menos un
// token de 4+ caracteres (ignorando el símbolo ® de los recurrentes).
// Usado para: detectar posibles duplicados en Registros, y (desde la
// Fase 3) para que el auto-registro de recurrentes reconozca cuándo un
// gasto real ya "cubrió" a un recurrente aunque la fecha no coincida.
export function sharesDescriptionWord(descA, descB) {
  const tokenize = (s) =>
    (s || "")
      .replace(/®/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 4);
  const wordsA = new Set(tokenize(descA));
  return tokenize(descB).some((w) => wordsA.has(w));
}

export function withinDays(dateA, dateB, margin) {
  return (
    Math.abs(new Date(dateA + "T00:00:00") - new Date(dateB + "T00:00:00")) <=
    margin * 864e5
  );
}
