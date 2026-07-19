// Foresee 2.0 — herramientas/build-index.js
// Escanea css/, js/ e index.html y arma un índice de selectores CSS,
// variables CSS, funciones/exports de JS e ids de HTML, cada uno con
// su archivo y número de línea exacto. Genera index-data.js (variable
// global, no fetch — así funciona abriendo buscador.html directo con
// doble clic, sin servidor).
//
// Uso: node herramientas/build-index.js   (correrlo de nuevo después
// de cambios grandes de código para que el índice no quede viejo)

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const entries = [];

function walk(dir, exts, cb) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, exts, cb);
    else if (exts.some((e) => name.endsWith(e))) cb(full);
  }
}

function relPath(full) {
  return path.relative(ROOT, full).replace(/\\/g, "/");
}

// ── CSS: selectores y variables ────────────────────────────────────
function indexCss(file) {
  const rel = relPath(file);
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

    // Variables CSS: --nombre: valor;
    const varMatch = trimmed.match(/^(--[\w-]+)\s*:/);
    if (varMatch) {
      entries.push({ type: "css-var", name: varMatch[1], file: rel, line: lineNum, snippet: trimmed.slice(0, 100) });
      return;
    }

    // Selectores: algo que termina en "{" y empieza con . # : [ o una etiqueta
    const selMatch = trimmed.match(/^([.#][^\{]+|[a-zA-Z][\w-]*(?:[.#:][^\{]*)?)\s*\{/);
    if (selMatch && !trimmed.startsWith("@")) {
      const selector = selMatch[1].trim();
      if (selector.length < 80) {
        entries.push({ type: "css-selector", name: selector, file: rel, line: lineNum, snippet: trimmed.slice(0, 100) });
      }
    }
  });
}

// ── JS: funciones y exports ────────────────────────────────────────
function indexJs(file) {
  const rel = relPath(file);
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    const exportFn = trimmed.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
    if (exportFn) {
      entries.push({ type: "js-export", name: exportFn[1], file: rel, line: lineNum, snippet: trimmed.slice(0, 100) });
      return;
    }
    const exportConst = trimmed.match(/^export\s+const\s+(\w+)/);
    if (exportConst) {
      entries.push({ type: "js-export", name: exportConst[1], file: rel, line: lineNum, snippet: trimmed.slice(0, 100) });
      return;
    }
    const fn = trimmed.match(/^(?:async\s+)?function\s+(\w+)/);
    if (fn) {
      entries.push({ type: "js-function", name: fn[1], file: rel, line: lineNum, snippet: trimmed.slice(0, 100) });
    }
  });
}

// ── HTML: ids y data-section/data-tab ──────────────────────────────
function indexHtml(file) {
  const rel = relPath(file);
  const lines = fs.readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    let m;
    const idRe = /\bid="([\w-]+)"/g;
    while ((m = idRe.exec(line))) {
      entries.push({ type: "html-id", name: `#${m[1]}`, file: rel, line: lineNum, snippet: line.trim().slice(0, 100) });
    }
    const dataRe = /\bdata-(section|tab)="([\w-]+)"/g;
    while ((m = dataRe.exec(line))) {
      entries.push({ type: "html-data", name: `data-${m[1]}="${m[2]}"`, file: rel, line: lineNum, snippet: line.trim().slice(0, 100) });
    }
  });
}

walk(path.join(ROOT, "css"), [".css"], indexCss);
walk(path.join(ROOT, "js"), [".js"], indexJs);
indexHtml(path.join(ROOT, "index.html"));

// ── Conceptos curados (en criollo) — de la Guía Rápida ─────────────
const conceptos = [
  { query: "tamaño de fuentes, tamaño de letra, font size, texto grande, texto chico", file: "css/base.css", desc: "Variables --font-xs/sm/base/md/lg/xl, sección 1. Cambiar una afecta toda la app." },
  { query: "colores, tema oscuro, tema claro, gris perla, paleta", file: "css/base.css", desc: "Sección 1 (oscuro) y 1b (claro). Variables --color-*." },
  { query: "color de acento por pestaña, color de cada sección", file: "css/base.css", desc: "Bloque 'Acento por sección', después de las variables." },
  { query: "espaciado, padding, separación entre elementos, margen", file: "css/base.css", desc: "Variables --space-xs/sm/md/lg/xl." },
  { query: "barra de pestañas, tab-bar, íconos de las pestañas", file: "css/base.css", desc: "Sección 6 'Tab bar'." },
  { query: "modal, ventana emergente, popup", file: "css/base.css", desc: "Sección 10 'Modal base' (aplica a todos los modales)." },
  { query: "dashboard, tarjetas de saldo ingresos gastos", file: "css/base.css", desc: "Sección 8 'Main layout + dashboard'." },
  { query: "tabla de registros, tabla de proyección, tabla de recurrentes, tabla de presupuesto", file: "css/secciones.css", desc: "Bloque de esa sección (en orden de construcción)." },
  { query: "tarjetas de credito, metas de ahorro, cc-card", file: "css/secciones.css", desc: "Clases .cc-card* — Tarjetas y Metas comparten el mismo CSS." },
  { query: "mobile, celular, responsive, pantalla chica", file: "css/base.css", desc: "Buscar @media (max-width: 768px) — hay uno en base.css y otro en secciones.css." },
  { query: "saldo, balance, cuanto tengo", file: "js/lib/balances.js", desc: "Motor único de cálculo de saldo, usado en toda la app." },
  { query: "calculadora, formulario nueva transaccion, nueva proyeccion", file: "js/lib/calc-modal.js", desc: "Calculadora unificada de Registros y Proyección." },
  { query: "categorias, iconos de categoria, selector de categoria", file: "js/lib/category-modal.js", desc: "Selector de categoría + buildCatDisplay." },
  { query: "voz, hablar, reconocimiento de voz", file: "js/lib/voice-parser.js", desc: "Interpreta lo que decís (la pantalla está en js/secciones/voz.js)." },
  { query: "importar csv, excel, foto de extracto, ocr", file: "js/lib/import-pipeline.js", desc: "Parseo de texto (CSV/Excel); ocr.js es para fotos." },
  { query: "notificaciones del navegador", file: "js/lib/notifications.js", desc: "sendBrowserNotification." },
  { query: "inicio de sesion, login, registro, menu principal, cambiar de pestaña", file: "js/main.js", desc: "Bootstrap y wiring global de la app." },
];

const output = `// Generado automáticamente por herramientas/build-index.js — no editar a mano.
// Última generación: ${new Date().toISOString()}
window.SEARCH_INDEX = ${JSON.stringify(entries)};
window.SEARCH_CONCEPTS = ${JSON.stringify(conceptos)};
`;

fs.writeFileSync(path.join(__dirname, "index-data.js"), output, "utf-8");
console.log(`Índice generado: ${entries.length} entradas (${conceptos.length} conceptos curados) -> herramientas/index-data.js`);
