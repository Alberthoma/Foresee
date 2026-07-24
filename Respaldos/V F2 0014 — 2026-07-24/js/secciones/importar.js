// Foresee 2.0 — importar.js
// Sección Importar: CSV/Excel de bancos + foto de extracto (OCR) con
// preview, asignación de banco/categoría, detección de duplicados y
// guardado masivo a Registros. Ver Proyecto-Anterior/MD/Pipeline de
// Importación CSV — Referencia.md para el flujo completo.
import { db, doc, collection, addDoc, deleteDoc, DB_COL } from "../firebase.js";
import { appState } from "../state.js";
import { formatCurrency, sharesDescriptionWord, withinDays } from "../lib/utils.js";
import { showLoading, hideLoading, showToast } from "../lib/ui.js";
import { openCategoryModal, UNKNOWN_ICON } from "../lib/category-modal.js";
import {
  parseCSVImport,
  processImportRows,
  parseXLSXImport,
  extractImportCode,
  pairZelleRows,
  detectImportDuplicates,
  bankBadgeClass,
  setImportNextId,
} from "../lib/import-pipeline.js";
import { processImportImage } from "../lib/ocr.js";

// Estado local del módulo de importación (no en appState) — igual que el
// origen, no necesita persistir entre sesiones.
let importRows = [];
let importSelectedIds = new Set();
let importNextBatchId = 0;
let importPendingRowId = null;

function resetImportState() {
  importRows = [];
  importSelectedIds.clear();
  setImportNextId(0);
  importNextBatchId = 0;
  importPendingRowId = null;
  const inp = document.getElementById("import-file-input");
  if (inp) inp.value = "";
}

function resetImportSection() {
  resetImportState();
  document.getElementById("import-drop-zone").classList.remove("hidden");
  document.getElementById("import-preview").classList.add("hidden");
  document.getElementById("import-summary").classList.add("hidden");
}

function toggleImportSelect(id) {
  if (importSelectedIds.has(id)) importSelectedIds.delete(id);
  else importSelectedIds.add(id);
  renderImportTable();
}

// Reconstruye las opciones del <select> de banco del encabezado y lo
// habilita solo si todas las filas vienen de la misma captura/archivo —
// si hay varias mezcladas, aplicar a "todas" pisaría bancos ya correctos
// de otra imagen del mismo lote.
function updateImportThBancoSelect() {
  const sel = document.getElementById("import-th-banco");
  if (!sel) return;
  sel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.hidden = true;
  placeholder.textContent = "Banco ▾";
  sel.appendChild(placeholder);
  appState.banks.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
  sel.value = "";
  const batchIds = new Set(importRows.map((r) => r.batchId));
  const singleBatch = importRows.length > 0 && batchIds.size === 1;
  sel.disabled = !singleBatch;
  sel.title = singleBatch
    ? "Asignar el mismo banco a todas las filas"
    : "Disponible solo cuando todas las filas vienen de la misma captura/archivo";
}

function renderImportTable() {
  const tbody = document.getElementById("import-tbody");
  tbody.innerHTML = "";

  const sorted = [...importRows].sort((a, b) => (b.fecha > a.fecha ? 1 : -1));

  let totalIncome = 0, totalExpense = 0;
  sorted.forEach((row) => {
    if (row.monto > 0) totalIncome += row.monto;
    else totalExpense += Math.abs(row.monto);
  });

  const cur = appState.currency || "USD";
  const fmt = (n) => formatCurrency(n, cur);

  const statsEl = document.getElementById("import-stats");
  statsEl.innerHTML = "";
  const stats = [
    { label: "Ingresos", value: fmt(totalIncome), cls: "import-stat--income" },
    { label: "Gastos", value: fmt(totalExpense), cls: "import-stat--expense" },
    { label: "Registros", value: importRows.length, cls: "" },
  ];
  stats.forEach(({ label, value, cls }) => {
    const div = document.createElement("div");
    div.className = `import-stat ${cls}`;
    const lbl = document.createElement("span");
    lbl.className = "import-stat__label";
    lbl.textContent = label;
    const val = document.createElement("span");
    val.className = "import-stat__value";
    val.textContent = value;
    div.appendChild(lbl);
    div.appendChild(val);
    statsEl.appendChild(div);
  });

  sorted.forEach((row) => {
    const tr = document.createElement("tr");
    if (row.duplicado && importSelectedIds.has(row._id)) tr.className = "import-row-dup";
    if (row.needsReview) tr.className = (tr.className ? tr.className + " " : "") + "import-row-review";

    const tdChk = document.createElement("td");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = importSelectedIds.has(row._id);
    chk.dataset.id = row._id;
    chk.addEventListener("change", () => toggleImportSelect(row._id));
    tdChk.appendChild(chk);

    // fecha — sin nowrap, el guión de "YYYY-MM-DD" es un punto de quiebre
    // válido y el navegador la parte en 2 líneas en pantallas angostas,
    // inflando el alto de toda la fila en móvil.
    const tdDate = document.createElement("td");
    tdDate.style.whiteSpace = "nowrap";
    tdDate.textContent = row.fecha;

    const tdDesc = document.createElement("td");
    tdDesc.textContent = row.descripcion || "—";
    tdDesc.style.cssText = "max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;";
    if (row.descripcionRaw || row.descripcion) tdDesc.dataset.tip = row.descripcionRaw || row.descripcion;

    // categoría (clickable) — sin categoría asignada se muestra el mismo
    // ícono "?" que usa Registros para transacciones importadas sin
    // categoría.
    const tdCat = document.createElement("td");
    const catSpan = document.createElement("span");
    catSpan.className = "import-cat-cell";
    if (row.categoria) {
      catSpan.textContent = row.categoria;
    } else {
      tdCat.style.textAlign = "center";
      catSpan.title = "Sin categoría — click para asignar";
      const icon = document.createElement("img");
      icon.src = UNKNOWN_ICON;
      icon.alt = "";
      icon.width = 18;
      icon.height = 18;
      // El reset global de la app pone "img { display: block; }" — un
      // <img> de bloque dentro de un <span> en línea agrega una caja de
      // línea extra y duplica el alto de la fila.
      icon.style.display = "inline-block";
      icon.style.verticalAlign = "middle";
      catSpan.appendChild(icon);
    }
    catSpan.addEventListener("click", () => {
      importPendingRowId = row._id;
      openCategoryModal((categoryName) => {
        const target = importRows.find((r) => r._id === importPendingRowId);
        if (target) target.categoria = categoryName;
        importPendingRowId = null;
        renderImportTable();
      });
    });
    tdCat.appendChild(catSpan);

    // banco (badge clicable — abre selector inline para corregir)
    const tdBanco = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `import-bank-badge ${bankBadgeClass(row.banco)}`;
    badge.textContent = row.banco;
    badge.style.cursor = "pointer";
    badge.title = "Click para cambiar el banco";
    badge.addEventListener("click", () => {
      const sel = document.createElement("select");
      sel.className = "cfg-select";
      sel.style.cssText = "font-size:var(--font-sm);padding:2px 4px;min-width:90px;";
      appState.banks.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        if (b === row.banco) opt.selected = true;
        sel.appendChild(opt);
      });
      if (!appState.banks.includes(row.banco)) {
        const opt = document.createElement("option");
        opt.value = row.banco;
        opt.textContent = row.banco;
        opt.selected = true;
        sel.insertBefore(opt, sel.firstChild);
      }
      sel.addEventListener("change", () => {
        row.banco = sel.value;
        row.bankDetected = true;
        renderImportTable();
      });
      sel.addEventListener("blur", () => renderImportTable());
      tdBanco.replaceChildren(sel);
      sel.focus();
      // focus() solo enfoca el <select>, no abre la lista nativa — hace
      // falta un click() dentro del mismo gesto del usuario para que el
      // navegador la despliegue.
      sel.click();
    });
    tdBanco.appendChild(badge);
    if (row.bankDetected === false) {
      const warnBanco = document.createElement("span");
      warnBanco.className = "import-dup-badge";
      warnBanco.style.marginLeft = "4px";
      warnBanco.title = "Banco no detectado automáticamente — verifica que sea correcto";
      warnBanco.textContent = "⚠️";
      tdBanco.appendChild(warnBanco);
    }

    const tdMonto = document.createElement("td");
    tdMonto.style.textAlign = "right";
    if (row.needsReview) {
      const montoInput = document.createElement("input");
      montoInput.type = "number";
      montoInput.step = "0.01";
      montoInput.placeholder = "Monto";
      if (row.monto) montoInput.value = row.monto;
      montoInput.title = "No se pudo confirmar el monto/signo de la imagen — verifícalo o ingrésalo manualmente";
      montoInput.className = "cfg-number-input";
      montoInput.style.cssText = "width:90px;text-align:right;padding:2px 6px;";
      montoInput.addEventListener("change", () => {
        const v = parseFloat(montoInput.value);
        if (!isNaN(v) && v !== 0) {
          row.monto = v;
          row.type = v >= 0 ? "income" : "expense";
          row.needsReview = false;
          renderImportTable();
        }
      });
      tdMonto.appendChild(montoInput);
    } else {
      tdMonto.className = row.monto >= 0 ? "amount--income" : "amount--expense";
      tdMonto.textContent = (row.monto >= 0 ? "+" : "") + fmt(row.monto);
    }

    const tdDup = document.createElement("td");
    if (row.duplicado) {
      const dupBadge = document.createElement("span");
      dupBadge.className = "import-dup-badge";
      dupBadge.title = "Posible duplicado — ya existe una transacción con misma descripción, monto, fecha y banco";
      dupBadge.textContent = "⚠️";
      tdDup.appendChild(dupBadge);
    }

    tr.append(tdChk, tdDate, tdDesc, tdCat, tdBanco, tdMonto, tdDup);
    tbody.appendChild(tr);
  });

  const selCount = importSelectedIds.size;
  const dupSel = importRows.filter((r) => r.duplicado && importSelectedIds.has(r._id)).length;
  let countText = `${selCount} de ${importRows.length} seleccionadas`;
  if (dupSel > 0) countText += ` (${dupSel} posibles duplicados)`;
  document.getElementById("import-sel-count").textContent = countText;

  const allChk = document.getElementById("import-select-all");
  allChk.checked = selCount === importRows.length && importRows.length > 0;
  allChk.indeterminate = selCount > 0 && selCount < importRows.length;

  updateImportThBancoSelect();
}

async function processImportFile(file) {
  const name = file.name;
  const ext = name.split(".").pop().toLowerCase();
  let newRows = [];
  try {
    if (ext === "csv") {
      const text = await file.text();
      newRows = processImportRows(parseCSVImport(text), name);
    } else if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      newRows = await parseXLSXImport(buf, name);
    } else if (file.type && file.type.startsWith("image/")) {
      newRows = await processImportImage(file);
    } else {
      showToast("Formato no soportado. Usa .csv, .xlsx o una imagen", "error");
      return;
    }
  } catch (err) {
    console.error("[Importar] Error al procesar archivo:", err);
    showToast(
      err && err.bankNotDetected ? err.message : "No se pudo leer el archivo. Verifica el formato.",
      "error",
    );
    return;
  }
  if (!newRows.length) {
    showToast("No se encontraron transacciones en el archivo.", "warning");
    return;
  }
  const batchId = importNextBatchId++;
  newRows.forEach((r) => { r.batchId = batchId; });
  importRows = [...importRows, ...newRows];
  pairZelleRows(importRows);
  detectImportDuplicates(importRows);
  importRows.forEach((r) => {
    if (!r.needsReview) importSelectedIds.add(r._id);
  });
  renderImportTable();
  document.getElementById("import-drop-zone").classList.add("hidden");
  document.getElementById("import-preview").classList.remove("hidden");
}

function showImportSummary(imported, failed, skipped = 0) {
  document.getElementById("import-preview").classList.add("hidden");
  const sumEl = document.getElementById("import-summary");
  const title = document.getElementById("import-summary-title");
  const detail = document.getElementById("import-summary-detail");
  title.textContent = `${imported} transacción${imported !== 1 ? "es" : ""} importada${imported !== 1 ? "s" : ""}`;
  const parts = [];
  if (failed > 0) parts.push(`${failed} no se pudo${failed !== 1 ? "eron" : ""} importar por error.`);
  if (skipped > 0) parts.push(`${skipped} omitida${skipped !== 1 ? "s" : ""} por duplicado.`);
  detail.textContent = parts.length ? parts.join(" ") : "Todas las transacciones se importaron correctamente.";
  sumEl.classList.remove("hidden");
  resetImportState();
  setTimeout(() => document.querySelector('.tab-btn[data-tab="registros"]')?.click(), 1200);
}

async function bulkImportTransactions() {
  const user = appState.currentUser;
  if (!user) return;
  const toImport = importRows.filter((r) => importSelectedIds.has(r._id));
  if (!toImport.length) {
    showToast("No hay transacciones seleccionadas.", "warning");
    return;
  }
  showLoading();
  // Snapshot antes de guardar: evita que el onSnapshot que se dispara tras
  // cada addDoc marque como duplicado a la siguiente fila del mismo lote
  // (ej. dos peajes idénticos el mismo día son transacciones reales).
  const preSaveTxs = [...appState.transactions];
  let imported = 0, failed = 0, skipped = 0;
  for (const row of toImport) {
    const amt = Math.abs(row.monto);
    const rowCode = extractImportCode(row.descripcion);
    const isDup = preSaveTxs.some((tx) => {
      if (Math.abs(tx.amount) !== amt || tx.date !== row.fecha) return false;
      if (rowCode) {
        const txCode = extractImportCode(tx.description || "");
        if (txCode && txCode === rowCode) return true;
      }
      const sameBank = (tx.bank || "").toLowerCase().trim() === (row.banco || "").toLowerCase().trim();
      if (sameBank && (tx.description || "").toLowerCase().trim() === (row.descripcion || "").toLowerCase().trim())
        return true;
      return sameBank && sharesDescriptionWord(tx.description, row.descripcion);
    });
    if (isDup) {
      skipped++;
      continue;
    }
    // Reemplaza el recurrente auto-registrado que coincida con esta
    // importación (mismo criterio que el auto-registro: palabra compartida
    // ±5 días).
    const recurringMatch = appState.transactions.find((tx) => {
      if (!tx.isRecurring) return false;
      if (!sharesDescriptionWord(tx.description, row.descripcion)) return false;
      return withinDays(tx.date, row.fecha, 5);
    });
    const txDesc = (row.descripcion || "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    const txObj = {
      type: row.type,
      amount: amt,
      date: row.fecha,
      bank: row.banco,
      category: recurringMatch ? recurringMatch.category : row.categoria,
      description: recurringMatch ? txDesc + " ®" : txDesc,
      createdAt: new Date().toISOString(),
      importedFrom: "csv",
      ...(row.type === "transfer" ? { transferDirection: row.monto < 0 ? "out" : "in" } : {}),
    };
    try {
      if (recurringMatch) {
        await deleteDoc(doc(db, DB_COL(user.uid, "transactions"), recurringMatch.id));
      }
      await addDoc(collection(db, DB_COL(user.uid, "transactions")), txObj);
      imported++;
    } catch {
      failed++;
    }
  }
  hideLoading();
  showImportSummary(imported, failed, skipped);
}

export function initImportar() {
  const dropZone = document.getElementById("import-drop-zone");
  const fileInput = document.getElementById("import-file-input");

  dropZone.addEventListener("click", (e) => {
    if (!e.target.closest("#import-select-btn") && e.target !== dropZone) return;
    fileInput.click();
  });
  document.getElementById("import-select-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    Array.from(fileInput.files).forEach((f) => processImportFile(f));
    fileInput.value = "";
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    Array.from(e.dataTransfer.files).forEach((f) => processImportFile(f));
  });

  document.getElementById("import-select-all").addEventListener("change", (e) => {
    if (e.target.checked) importRows.forEach((r) => importSelectedIds.add(r._id));
    else importSelectedIds.clear();
    renderImportTable();
  });

  document.getElementById("import-deselect-dups-btn").addEventListener("click", () => {
    importRows.filter((r) => r.duplicado).forEach((r) => importSelectedIds.delete(r._id));
    renderImportTable();
  });

  document.getElementById("import-confirm-btn").addEventListener("click", bulkImportTransactions);
  document.getElementById("import-reset-btn").addEventListener("click", resetImportSection);
  document.getElementById("import-new-btn").addEventListener("click", resetImportSection);

  // Banco (encabezado): <select> real (no un texto que se reemplaza por
  // uno al hacer click) porque un click programático nunca abre de forma
  // confiable la lista nativa de un <select> creado al vuelo.
  document.getElementById("import-th-banco").addEventListener("change", (e) => {
    const banco = e.target.value;
    if (!banco) return;
    importRows.forEach((r) => {
      r.banco = banco;
      r.bankDetected = true;
    });
    renderImportTable();
  });
}
