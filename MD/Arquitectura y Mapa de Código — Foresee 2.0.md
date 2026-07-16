# Arquitectura y Mapa de Código — Foresee 2.0

Referencia detallada de qué hay en cada archivo del proyecto. Objetivo: ubicar en segundos qué archivo tocar para un pedido dado, sin tener que leer los ~28 módulos para orientarse. Ver también `CLAUDE.md` (resumen + protocolos) y, para el pipeline de Importar específicamente, `Proyecto-Anterior/MD/Pipeline de Importación CSV — Referencia.md` (se mantiene como referencia porque `import-pipeline.js` y `ocr.js` replican ese flujo función por función).

## Cómo está dividido, en una frase
`js/lib/` = lógica **compartida** entre varias secciones (un motor, un helper, un modal genérico). `js/secciones/` = lógica de **una sola pestaña**, un archivo por pestaña. Si el pedido es "algo se ve/rompe en la pestaña X", empezar por `secciones/X.js`. Si es "un cálculo/comportamiento está mal en varias pantallas a la vez", casi seguro vive en `lib/`.

---

## CSS

### `css/base.css` (882 líneas) — todo lo que es igual en cualquier pestaña
| Bloque | Contenido |
|---|---|
| 1. Variables (tema oscuro) | Tokens de color/espaciado/tipografía por defecto |
| 1b. Modo claro "Gris Perla" | Override de los mismos tokens bajo `html[data-theme="light"]` — **`--color-primary` y `--color-accent` NO son alias, divergen a propósito en claro** |
| 2. Reset & base | Reset global, `img { display: block }` |
| 3. Loading overlay | Spinner de carga inicial |
| 3b. Mobile fullscreen prompt | Banner "Iniciar Aplicación" que aparece al loguearse |
| 3c. Pull-to-refresh | Indicador de flecha/spinner arriba de la pantalla |
| 4. Toast | Notificaciones flotantes (éxito/error/warning) |
| 5. Header bar (desktop) | Logo, título, botones de header (incluye filosofía, pantalla completa) |
| 6. Tab bar | Barra de pestañas fija abajo — **único cambio de layout vs. el origen** |
| 7. View state | Clases `view-dashboard` / `view-content` en `<body>` |
| 8. Main layout + dashboard | Grid de tarjetas del dashboard |
| 9. Content area | Action bar (botones por pestaña) + `.tab-pane` |
| 10. Modal base | `.modal-overlay`, `.modal-box`, `.modal-header` — base que usan TODOS los modales |
| 11. Form elements | Inputs/selects compartidos, `.form-field`, `.cfg-note` |
| 12. Auth modal | Login/registro |
| 13. Footer | Pie de página |
| 13b. Info modals | Filosofía/Privacidad/Términos/Cookies |
| 14. Responsive mobile (≤768px) | Ajustes base para pantallas chicas |

### `css/secciones.css` (897 líneas) — estilos propios de cada pestaña
Un bloque por sección, en el orden en que se construyeron las fases: Recurrentes, Proyección, Saldos, Presupuesto, Reportes, Tablas (base compartida Registros/Proyección), Filter group, Calculator modal, Category modal, Tarjetas, Gastos Comunes, Configuración, Tutorial, Onboarding, Voz, Importar — más un bloque de responsive mobile a mitad de archivo (Recurrentes/Proyección/Registros/Presupuesto) con los fixes documentados de la Fase 4 (colapso de columna en `#budget-table`, cascada de `.rep-savings-row`).

---

## JS — arranque (raíz de `js/`)

| Archivo | Qué hace |
|---|---|
| `firebase.js` | Único punto de import del SDK de Firebase. Exporta `auth`, `db`, `APP_ID`, `DB_COL`/`DB_PREF`/`DB_GASTOS_COMUNES` (rutas de Firestore), `FCM_VAPID_KEY`, `loadMessaging()` (lazy), y re-exporta las funciones de Auth/Firestore que usa el resto de la app. **Nada más debería importar del CDN de Firebase directamente.** |
| `state.js` | `appState` (el estado global — transacciones, categorías, bancos, filtros, usuario, etc.), `onStateChange(fn)`/`scheduleRenderAll()` (pub-sub con debounce de 50ms), `loadUserData()` (los 6 `onSnapshot` de Firestore), `unloadUserData()`, `isDataReady()`/`isRecurringReady()`, `saveNewDescriptionIfNeeded()`, `DEFAULT_ICON`. |
| `main.js` | Bootstrap: login/registro/logout, `switchTab`/`showDashboardView` (no exportadas — privadas del módulo), `SECTION_RENDERERS` (mapa pestaña→función de render), `TAB_ACTIONS`/`ALL_ACTION_IDS` (qué botones de la action-bar se muestran en cada pestaña), `EDIT_SELECTED_HANDLERS`/`DELETE_SELECTED_HANDLERS` (selección múltiple en Registros/Recurrentes/Proyección), `setupEventListeners()` (llama a todos los `init*()` de cada sección + `initModalSystem()` con la lista completa de modales), flag `_showFullscreenOnLoad`. **Punto de entrada real de la app** — acá se conectan todos los módulos entre sí. |

---

## `js/lib/` — motores y helpers compartidos

| Archivo | Exports | Para qué |
|---|---|---|
| **`ui.js`** (343L) | `showLoading`/`hideLoading`, `showToast`, `markInvalid`, `fillSelect` (populador genérico de `<select>`), `openModal`/`closeModal`/`registerModal`/`initModalSystem` (gestor genérico de modales: focus-trap + aria-hidden + scroll-lock centralizados), `openConfirmModal`/`closeConfirmModal`/`runConfirmCallback` (modal de confirmación genérico), `guardClose` (pregunta antes de cerrar un formulario con cambios sin guardar), `updateSelectionButtons`, `toggleInfoRow`, `initTooltip`, `isLightTheme`/`chartColors`/`applyTheme`/`toggleTheme`/`initThemeBtn`. | El módulo más importado de todo el proyecto — cualquier modal, cualquier tabla con selección múltiple, cualquier toast pasa por acá. |
| **`balances.js`** (184L) | `sharesRefToken`, `buildInternalPairMap`, `addsToBalance`, `computeTotalBalance`, `buildTransferPairPartners`, `findSuspectDuplicateIds`, `computeRunningBalanceMap`. | **El motor único de saldos.** Si un cálculo de balance está mal en cualquier pantalla (Dashboard, Registros, Proyección, Saldos, Exports), es acá. |
| **`calc-modal.js`** (225L) | `openCalcModal({editItem, initialTipo, onFinalize, titleNew, titleEdit})`, `initCalcModal`. | La calculadora unificada — Registros y Proyección la usan pasando su propio `onFinalize`. Si algo del formulario de nueva/editar transacción está mal (montos, teclado, banco, fecha), es acá — no busques un "proj-modal", no existe. |
| **`category-modal.js`** (89L) | `openCategoryModal(onSelect)`, `closeCategoryModal`, `initCategoryModal`, `buildCatDisplay(name, type, isImported)`, `TRANSFER_ICON`, `UNKNOWN_ICON`. | Selector de categoría (grilla de íconos) + el helper que arma el ícono+nombre de categoría en cualquier tabla. |
| **`import-pipeline.js`** (333L) | `IMPORT_ALIASES`, `parseCSVImport`, `detectBankFromText`, `bankBadgeClass`, `processImportRows`, `parseXLSXImport`, `pairZelleRows`, `cleanBankDescription`, `extractImportCode`, `detectImportDuplicates`, `setImportNextId`/`nextImportId`. | Parseo de CSV/Excel de bancos, limpieza de descripciones, detección de banco/duplicados/transferencias Zelle. Ver el documento de referencia del pipeline para el detalle función por función. |
| **`ocr.js`** (567L) | `looksLikeAmountToken`, `parseOcrAmount`, `clusterWordsIntoLines`, `stripDividerLines`, `processImportImage` (foto de extracto → filas), `processReceiptImage` (foto de recibo → 1 transacción). | Todo lo de Tesseract.js: reconstrucción de líneas/bloques desde bounding boxes, parser de escritorio + fallback móvil, extractor de recibos. |
| **`exports.js`** (318L) | `cfgExportJson`, `cfgImportJson`, `exportExcel` (4 hojas con fórmulas), `exportPDF`. | Exportación de datos — Configuración. |
| **`recurring-engine.js`** (163L) | `resetRecurringEngineState`, `tryProcessRecurringExpenses`, `checkRecurringPaymentReminders`. | Auto-registro mensual de gastos recurrentes (con cooldown de 60s) + recordatorios de vencimiento. |
| **`month-transition.js`** (155L) | `resetMonthTransitionState`, `tryCheckMonthTransition`, `runMonthTransition`, `initiateNewMonth`, `recoverFromArchive`, `commitInChunks`, `resetPeriod`. | Cambio de mes automático — archiva sin borrar, con recuperación manual desde Configuración. |
| **`voice-parser.js`** (253L) | `parseVoiceInput(rawText, {categories, banks, descriptions})`. | Parser NLP en español: tipo/fecha/monto/banco/categoría/descripción a partir de una transcripción libre. |
| **`number-parser.js`** (57L) | `wordValues`, `parseSpanishNumber(text)`. | Números escritos en español → valor numérico ("quince con cuarenta y cinco" → 15.45). `voice-parser.js` deriva de `wordValues` las palabras válidas de día del mes. |
| **`pwa.js`** (96L) | `requestFullscreen`, `exitFullscreen`, `setupPullToRefresh(onRefresh)`, `setupSwipeNavigation({getCurrentTab, switchTab})`. | Comportamiento nativo-like: pantalla completa, pull-to-refresh, swipe entre pestañas. |
| **`notifications.js`** (15L) | `sendBrowserNotification(title, body)`. | Notificación nativa del navegador — usada por recurrentes, presupuesto y tarjetas. |
| **`icons.js`** (14L) | `ICON_PENCIL`, `ICON_TRASH`, `ICON_TRASH_SOLID`. | SVGs inline de botones de acción en tablas. |
| **`utils.js`** (63L) | `formatCurrency`, `roundMoney`, `getCurrentMonthStr`, `formatMonthLabel`, `formatDate`, `toTitleCase`, `sharesDescriptionWord`, `withinDays`. | Helpers puros sin DOM, usados en casi todos los módulos. |

---

## `js/secciones/` — una pestaña = un archivo

| Archivo | Exports | Qué contiene |
|---|---|---|
| **`registros.js`** (521L) | `renderTransactionsTable`, `saveTransaction`, `deleteTransaction`, `deleteSelectedItems`, `editSelectedItem`, `initRegistros`. | Tabla de Registros: saldo corrido, categoría/descripción editables inline, transferencias, selección múltiple, badge de duplicados. `saveTransaction`/`deleteTransaction` los reutiliza `proyeccion.js` para las filas de transacción real que se muestran ahí. |
| **`proyeccion.js`** (352L) | `getDynamicProjections`, `renderProyeccionTable`, `saveProjection`, `editSelectedProjection`, `deleteSelectedProjection`, `initProyeccion`. | Proyección dinámica (transacciones reales + proyecciones manuales + asientos virtuales de Recurrentes). Reutiliza el `calc-modal` y las funciones de `registros.js`, no tiene formulario propio. |
| **`recurrentes.js`** (274L) | `renderRecurringTable`, `editSelectedRecurring`, `deleteSelectedRecurring`, `initRecurrentes`. | CRUD de gastos recurrentes. El auto-registro y recordatorios viven en `lib/recurring-engine.js`, no acá. |
| **`comunes.js`** (503L) | `computeAllAmounts`, `saveGastosComunesState`, `renderGastosComunesTable`, `initComunes`. | Gastos comunes: división equal/porcentaje/manual en cascada, quién pagó y en qué banco. |
| **`tarjetas.js`** (258L) | `calculateMonthlyPayment` (amortización francesa), `renderCreditCardsTable`, `checkCreditCardNotifications`, `initTarjetas`. | Tarjetas de crédito: deuda, límite, cuota estimada, alertas visuales + notificación nativa al 80%+ del límite. |
| **`saldos.js`** (86L) | `renderBankBalances`. | Saldo por banco + total, usando el motor de `lib/balances.js`. |
| **`reportes.js`** (555L) | `renderReportes`, `initReportes`. | 7 bloques con Chart.js: donut de categorías (con detalle al click), flujo de caja, tasa de ahorro, evolución del saldo, recurrentes vs. variables, gasto por día, comparativa mensual, resumen anual. |
| **`presupuesto.js`** (204L) | `renderBudgetTable`, `checkBudgetLimits`, `initPresupuesto`. | Límites de presupuesto por categoría con autoguardado; la actualización en vivo reutiliza la misma función de cálculo que el render inicial. |
| **`configuracion.js`** (709L) | `renderConfigurationLists`, `initConfiguracion`. | El archivo más grande — categorías/bancos/descripciones, alias/moneda/saldo inicial, notificaciones (in-app/email/push), exportar, reiniciar período, eliminar cuenta. Si el pedido toca cualquier cosa de "Configuración", empieza acá. |
| **`importar.js`** (456L) | `initImportar`. | UI de Importar: drop zone, tabla de preview, banco/categoría editables inline, guardado masivo. La lógica de parseo vive en `lib/import-pipeline.js` y `lib/ocr.js` — este archivo es solo la orquestación de pantalla. |
| **`voz.js`** (180L) | `initVoz`. | Botón de micrófono (Web Speech API) + panel de confirmación editable. El parseo NLP vive en `lib/voice-parser.js`. |
| **`onboarding.js`** (184L) | `openTutorialModal`, `showOnboarding`, `shouldShowOnboarding`, `initOnboarding`. | Bienvenida de usuario nuevo, datos de demo, tutorial de 7 videos. |
| **`dashboard.js`** (95L) | `renderDashboard`. | Tarjetas del dashboard (saldo/ingresos/gastos del mes) + alertas de tarjetas de crédito y recurrentes próximos a vencer. |

---

## Preguntas frecuentes al ubicar código

- **"El saldo está mal en [cualquier pantalla]"** → `lib/balances.js`
- **"Algo del formulario de nueva transacción/proyección"** → `lib/calc-modal.js`
- **"Un modal no abre/cierra bien"** → `lib/ui.js` (gestor genérico) + el `init*()` del módulo dueño de ese modal
- **"Falla el parseo de un banco/CSV"** → `lib/import-pipeline.js` (texto) o `lib/ocr.js` (foto)
- **"La voz entendió mal algo"** → `lib/voice-parser.js` (parseo) vs. `secciones/voz.js` (UI/confirmación)
- **"Un gráfico de Reportes está mal"** → `secciones/reportes.js`
- **"Algo de Configuración"** → `secciones/configuracion.js` (es el archivo más grande, 709 líneas)
