# Foresee 2.0 — Reescritura depurada de Foresee

> **DOCUMENTO DE TRASPASO ENTRE SESIONES.** Este archivo contiene todo el contexto necesario
> para continuar el proyecto sin releer el código origen completo. Léelo entero antes de tocar nada.
> Última actualización: 2026-07-14 (sesión de análisis y planificación).

---

## 1. Qué hay en este repositorio

| Ruta | Qué es |
|---|---|
| `proyecto-anterior/` | **La app origen** (Foresee V FSA 0061): funciona en producción, NO SE TOCA. Es la referencia. |
| `proyecto-anterior/index.html` | Todo el código origen: 17.784 líneas (CSS 38-4554, HTML 4556-6957, JS módulo 6957-17781) |
| `proyecto-anterior/CLAUDE.md` | Documentación maestra del origen: historial de 61 versiones, protocolos, arquitectura |
| `proyecto-anterior/MD/Pipeline de Importación CSV — Referencia.md` | **CRÍTICO**: pipeline de importación función por función + 12 lecciones aprendidas. Leer antes de la Fase 8 |
| `proyecto-anterior/functions/` | Cloud Functions reales (recordatorios email/push). NO SE TOCAN — sirven a ambas apps |
| `/` (raíz) | **Aquí se construye Foresee 2.0** (aún vacía salvo este archivo) |

- **Rama de trabajo:** `claude/repo-restructure-subfolder-h7ur3w`. Commit y push al terminar cada fase.
- **Regla de oro:** el usuario (Albert, hispanohablante — trabajar SIEMPRE en español) quiere
  **exactamente la misma funcionalidad del origen, ni una función menos**, en código depurado,
  más pequeño y modular.

---

## 2. Qué es Foresee (la app)

App web de **gestión de presupuesto personal**, mobile-first, en español, PWA instalable.
Backend: **Firebase Auth + Firestore** (proyecto `wittfinances-282f1`). Un usuario real (Albert)
con datos reales; hay plan de comercialización futuro.

**Secciones (11):** Registros (transacciones con saldo corrido), Voz (dictado NLP en español),
Proyección (saldo futuro con recurrentes virtuales), Gastos Recurrentes (auto-registro mensual ®),
Gastos Comunes (división de gastos entre personas), Tarjetas de Crédito (deuda/cuota estimada),
Saldos de Cuentas (por banco), Reportes (7 bloques con Chart.js), Presupuesto (límites por
categoría con barras), Configuración (todo: categorías con íconos, bancos, alias, divisa,
contraseña, notificaciones navegador/email/push FCM, JSON import/export, Excel 4 hojas, PDF,
nuevo mes, recuperar archivo, reiniciar período, eliminar cuenta, onboarding 3 pasos, datos demo,
tutorial 7 videos), Importar (CSV/Excel/foto OCR con Tesseract.js + escáner de recibos).

**Datos en Firestore** (la app nueva usa LAS MISMAS rutas — compatibilidad total):
```
artifacts/wittfinances-282f1/users/{uid}/
  transactions/{id}     → {type: income|expense|transfer, amount, date "YYYY-MM-DD", bank,
                            category, description, createdAt, transferLeg?, transferDirection?,
                            isRecurring?, importedFrom?, isArchived?}
  projections/{id}      → mismo shape básico
  recurringExpenses/{id} → {description, category, bank, amount, day 1-31, sharedAmount?}
  creditCards/{id}      → {bank, dueDate, amount, limit, rate, months, exclude}
  fcmTokens/{token}
  user_data/preferences → {categories:[{name,icon}], banks:[], descriptions:[], categoryBudgets:{},
                            openingBalance, userAlias, currency, notificationsEnabled,
                            emailRemindersEnabled, pushRemindersEnabled, lastMonthProcessed}
  user_data/gastosComunes → {items:[{id,name,totalAmount,people:[{name}],distribution:{idx:{method,value,paidDay?,txId?}}}]}
  user_data/archive_YYYY-MM → cierre de mes (transactions[], projections[], openingBalance, finalBalance)
```
CDN del origen (únicas librerías permitidas): Firebase 11.6.1 (módulos ES), Chart.js 4.4.4,
jsPDF 2.5.1 + autotable, SheetJS xlsx 0.18.5, Tesseract.js 5 (lazy, solo al usar OCR).
Config Firebase: está en el origen líneas 6997-7010 (apiKey, VAPID key, etc.) — copiarla tal cual.

### Mecanismos delicados del origen (entenderlos antes de portarlos)
1. **Transferencias emparejadas**: `sharesRefToken` (últimos 5 chars de tokens alfanuméricos 6+ con
   dígito) detecta las dos patas de una transferencia propia (misma fecha+monto, banco distinto).
   `buildInternalPairMap` decide quién suma ('recv') y quién resta ('send'); `buildTransferPairPartners`
   + `effectiveOrder` las mantiene adyacentes en la tabla sin romper la columna Saldo. Origen ~8267-8390.
2. **Recurrentes ®**: `processRecurringExpenses` (origen ~7857) auto-registra por mes con detección de
   huecos hasta 12 meses, clave de dedup `fecha_categoria_descripcion`, filtro `coveredByImport`
   (palabra compartida ±5 días vía `sharesDescriptionWord`), cooldown 60s en sessionStorage
   (parpadeos de auth), y sufijo " ®". Al importar, la transacción real reemplaza al recurrente
   conservando su categoría.
3. **Cambio de mes**: `runMonthTransition` archiva a `archive_YYYY-MM` **sin borrar nada** (fix
   crítico V FSA 0060 tras pérdida de datos) + botón "Recuperar Datos Archivados".
4. **Importación**: pipeline completo documentado en `proyecto-anterior/MD/Pipeline de
   Importación CSV — Referencia.md` — leerlo íntegro antes de la Fase 8. NO reinventar
   `cleanBankDescription` ni los parsers OCR: copiarlos casi intactos (están depurados por
   iteración real con datos bancarios de BoA/Chase/Wells Fargo).
5. **Voz**: `parseVoiceInput` (origen ~15345) — parser NLP propio: numberParser español,
   diccionarios de keywords ingreso/gasto, Levenshtein contra bancos/categorías, 5 estrategias
   de extracción de monto. Copiar casi intacto.
6. **Cálculo de cuota de tarjeta**: `calculateMonthlyPayment` (amortización francesa). Distribución
   de gastos comunes: `computeAllAmounts` (cascada equal/percentage/manual). Copiar intactos.

---

## 3. Qué quiere el usuario (decisiones FINALES, ya cerradas)

### Arquitectura
- **Módulos ES nativos, sin build, sin npm** — publica igual en GitHub Pages. Archivos separados:
```
/index.html          (solo estructura: secciones, modales, nav)
/css/base.css        (tokens 2 temas + reset + componentes)   /css/secciones.css
/js/main.js  /js/state.js  /js/firebase.js
/js/lib/utils.js  ui.js  balances.js  recurrentes-engine.js  import-pipeline.js  ocr.js  voz-parser.js
/js/secciones/dashboard.js registros.js proyeccion.js recurrentes.js comunes.js tarjetas.js
              saldos.js reportes.js presupuesto.js configuracion.js voz.js importar.js
/manifest.json  /sw.js   (copiados del origen)
```
- **CSS puro** (sin Tailwind ni frameworks). **Ninguna librería nueva.**
- Objetivo: ~9.000-10.500 líneas totales (vs 17.784) sin perder funcionalidad.

### Diseño visual (decisión definitiva tras 3 rondas de muestras — NO reabrir)
- **Se conserva el estilo del origen TAL CUAL** (el usuario lo confirmó con 5 capturas de su iPhone):
  tema oscuro azul-marino actual (tokens origen líneas 42-89: bg `#0f1117`, surface `#1a1d27`,
  surface-2 `#22253a`, border `#2a2d3a`, text `#e8eaf0`, accent `#4f8fff`, danger `#f05252`,
  success `#22c97a`, warning `#f59e0b`) y tema claro "Gris Perla" (líneas 94-115: bg `#f0f2f5`,
  text `#1a1d23`, accent `#1d4ed8`, danger `#b91c1c`, success `#15803d`). Acentos por sección
  (líneas 121-182). Íconos 3D de Cloudinary en los botones de sección y categorías (URLs en
  origen: tab bar ~4830-4968, PRESET_ICONS ~7071).
- **ÚNICO cambio de layout: la barra de tab-btn (botones con imagen 3D) va FIJA al margen
  inferior de la pantalla** (hoy está arriba). Scrolleable horizontal, mismo aspecto.
- **Formularios: SIEMPRE modales flotantes** disparados por botones (nunca inline). El de
  transacción es **la calculadora del origen con comportamiento idéntico**: barra Ingreso/Gasto →
  fecha → descripción → banco → teclado numérico (7-9/4-6/1-3/0. con + − × ÷, ⌫, `safeEval`) →
  «✓ Listo» → **abre el modal de categoría** (grid de categorías con íconos) que completa el
  guardado. El modal de categoría se reutiliza para editar categoría en Registros y asignar en Importar.
- **Formulario unificado**: crear y editar usan el mismo modal; transacción y proyección el mismo
  modal con parámetro de modo (el origen tenía modales separados → redundancia eliminada).
- **Colores de montos**: gasto rojo, ingreso verde, saldo azul — y **el signo manda: cualquier
  número negativo se pinta rojo** aunque sea un saldo (mejora vs origen, donde el saldo negativo
  salía azul). Sin negrillas en cifras; fuente mono tabular. Texto principal negro/blanco puro.
- Tarjetas del dashboard con su color de operación (línea/borde superior o lateral azul/verde/rojo
  + etiqueta en su color), como el origen.
- Tipografía del sistema (el origen no carga fuentes externas; mantener).

### Depuración acordada (análisis línea por línea ya hecho — hallazgos)
**Eliminar (código muerto):** `exportCSV()` completa + sus 3 botones ocultos (~9596-9666; decidido
con el usuario — Excel la reemplazó); migración `gastosComunes.people[]` global (~7691); tokens CSS
duplicados (`--color-text-2`≡muted, `--color-primary`≡accent, `--color-bg-secondary`≡surface, etc.);
entradas duplicadas en PRESET_ICONS; alias `updateDeleteButtonVisibility`; el localStorage
`foresee-filter-month` se escribe y nunca se lee (→ convertir en mejora: restaurar mes al abrir).

**Unificar (redundancias):** UN motor de saldos `lib/balances.js` (hoy la lógica suma/resta está
repetida con INCONSISTENCIAS en renderTransactionsTable, renderDashboard, exportExcel,
renderProyeccionTable, renderBankBalances — p.ej. el dashboard ignora transferencias externas y el
gráfico de evolución las resta todas); un `fillSelect()` (hoy 8 variantes de poblar selects); un
gestor de modales genérico (hoy ~15 repeticiones + MutationObserver); función única para la fila
expandible "info" (duplicada en reg y proj); utilidad única "¿Guardar descripción?" (3 variantes);
el listener de Presupuesto en vivo re-implementa renderBudgetTable (~85 líneas); helper
`enterFlow()` para cadenas Enter→focus; CSS reescrito desde cero sobre los mismos tokens
(~4.500 → ~1.600 líneas).

**Copiar casi intacto (NO reinventar):** cleanBankDescription, extractImportCode,
detectImportDuplicates, pairZelleRows, sharesRefToken, sharesDescriptionWord, todo el pipeline
OCR + escáner de recibos, processRecurringExpenses, transición/recuperación de mes,
parseVoiceInput, calculateMonthlyPayment, computeAllAmounts, sw.js, manifest.json.

### Mejoras aprobadas (además de las mismas funciones)
1. Restaurar el mes filtrado al abrir (hoy se guarda y no se lee).
2. Saldo consistente en todas las vistas vía `lib/balances.js`.
3. Negativos siempre en rojo.
4. Estados vacíos con guía ("Agrega tu primer banco en Configuración →").
5. Textos de confirmaciones/toasts consistentes; labels/aria completos.

---

## 4. Plan de fases (estado actual)

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Diseño: **cerrado** — estilo del origen + tab bar abajo | ✅ |
| 1 | Esqueleto: index.html, css/base.css (tokens origen 2 temas), tab bar inferior, auth completa, state.js (6 listeners Firestore), dashboard con alertas | ⬅ **SIGUIENTE** |
| 2 | Registros: tabla con saldo corrido (balances.js), modal calculadora + modal categoría, transferencias, edición inline, selección múltiple, badge ⚠️ duplicados, filas info | ⬜ |
| 3 | Recurrentes + Proyección (auto-registro ®, virtuales, mes siguiente, recordatorios) | ⬜ |
| 4 | Saldos + Reportes (7 bloques Chart.js) + Presupuesto | ⬜ |
| 5 | Tarjetas + Gastos comunes | ⬜ |
| 6 | Configuración completa (todo el listado de la sección 2) | ⬜ |
| 7 | Voz | ⬜ |
| 8 | Importar (leer ANTES el doc de referencia del pipeline) | ⬜ |
| 9 | PWA + cierre: manifest, sw, fullscreen, pull-to-refresh, swipe, offline dot, checklist paridad | ⬜ |

**Protocolo por fase:** construir → probar con `python3 -m http.server` (módulos ES necesitan
servidor; verificar con captura headless: `/opt/pw-browsers/chromium --headless=new --no-sandbox
--screenshot=...`) → `node --check` de cada módulo JS → **commit + push** a la rama
(`git push -u origin claude/repo-restructure-subfolder-h7ur3w`) → actualizar la tabla de estado
de ESTE archivo. Así ninguna interrupción por límite de sesión pierde trabajo.

**Verificación de paridad:** comparar cada sección contra el origen (mismos números con la cuenta
real del usuario). Mantener `MD/paridad-funcional.md` con el checklist de funciones ✅.

---

## 5. Contexto de trabajo con el usuario

- Albert escribe en español; responder SIEMPRE en español. Prefiere peticiones grandes y turnos
  productivos completos (su plan de Claude alcanza el límite rápido — por eso existe este archivo).
- Al agotarse una sesión, él abrirá una nueva y dirá "Continúa Foresee 2.0 según el plan":
  leer este archivo + la tabla de fases, y continuar por la primera fase ⬜/⬅ sin releer el origen
  completo (solo la sección que se esté portando, con Read + offset/limit).
- El origen sigue en producción (GitHub Pages) — no romperlo. La app nueva usa las mismas
  colecciones Firestore, así que Albert puede comparar ambas lado a lado con sus datos reales.
- Historial de decisiones de diseño: hubo 3 rondas de muestras (A Esmeralda/B Azul/C Piedra,
  luego modales flotantes + tarjetas por color, luego calculadora) que quedaron DESCARTADAS al
  decidir conservar el estilo del origen. No proponer rediseños nuevos.
