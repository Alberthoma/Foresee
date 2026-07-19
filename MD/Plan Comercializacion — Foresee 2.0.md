# Plan de Comercialización — Foresee 2.0

**Creado:** 2026-07-18
**Contexto:** el usuario (Alberto) quiere comercializar Foresee 2.0. Vive en Estados Unidos. No tiene definido el modelo de precio — se definió por comparación con el mercado (ver sección "Posicionamiento y precio"). Este documento se actualiza a medida que se ejecuta cada fase — no es un plan fijo, es la referencia viva.

---

## Posicionamiento — la decisión central de la que depende todo lo demás

Foresee **no compite de igual a igual** con Mint/YNAB/Monarch/Copilot: esas apps ganan por la sincronización automática con el banco (Plaid), algo que Foresee no tiene y que es caro/complejo de agregar.

Foresee tiene dos ventajas reales que esas apps no ofrecen:
1. **No requiere vincular credenciales bancarias a un tercero** — todo es entrada manual, foto (OCR) o CSV.
2. **Español nativo, con voz en español natural** (`voice-parser.js`) — ninguna app grande de EE.UU. lo ofrece.

Sumado a que Alberto quiere agregar **inglés** próximamente (la app ya soporta múltiples monedas, lo que confirma una ambición más amplia que un solo idioma), el posicionamiento recomendado es:

> **Foresee es la app de finanzas personales bilingüe (ES/EN) para quienes no quieren o no pueden vincular su cuenta bancaria a un tercero** — con foco inicial en la comunidad hispanohablante de EE.UU. (40M+ personas, tasa de "unbanked/underbanked" más alta que el promedio según la FDIC), expandible a mercado general bilingüe.

Este posicionamiento decide el precio (ver abajo), qué features priorizar, y qué mensaje de marketing usar.

---

## Fase 0 — Seguridad (bloqueante, antes de aceptar el primer usuario pago)

- [ ] **Traer las reglas de Firestore al repo como código** (`firestore.rules` + `firebase.json`). Hoy viven solo en la consola de Firebase, invisibles y sin control de versiones — no se puede confirmar que un usuario no pueda leer los datos de otro. Alberto comparte lo que hay configurado hoy → Claude lo revisa antes de tocar nada.
- [ ] Confirmar que las reglas restringen cada ruta `artifacts/{proyecto}/users/{uid}/...` a `request.auth.uid == uid`.
- [ ] Agregar **Firebase App Check** — evita que bots/scripts golpeen Firestore/Cloud Functions simulando ser la app real (importante en cuanto hay dinero de por medio).
- [ ] Evaluar exigir verificación de email al registrarse (`sendEmailVerification`) — hoy no existe.
- [ ] Confirmar plan de facturación de Firebase (Blaze) y poner alertas de presupuesto en Google Cloud Console para no llevarse una sorpresa de costo con más usuarios.

## Fase 1 — Legal y negocio (requiere profesional — no lo resuelve Claude)

- [ ] Consultar abogado/contador en EE.UU. sobre: figura legal para cobrar (LLC vs. persona individual), impuestos sobre ingresos de una app, cumplimiento normativo si hay usuarios en distintos estados.
- [ ] Redactar Términos de Servicio y Política de Privacidad reales (los actuales en `index.html` son un placeholder de ejemplo — dicen explícitamente "no autorizado para uso comercial", hay que reemplazarlos).
- [ ] Definir política de reembolsos/cancelación antes de activar cobros.

## Fase 2 — Monetización técnica

- [ ] Diseñar el modelo de planes: **freemium recomendado** — entrada manual ilimitada gratis; nivel pago (~$4.99–6.99/mes o ~$40–50/año) desbloquea OCR de recibos/extractos, exportar Excel/PDF, gastos comunes multi-persona. Precio bajo porque el gancho de las apps caras (sync bancario automático) no aplica acá — hay que competir por privacidad/idioma, no iguales features.
- [ ] Integrar **Stripe** (Checkout + Webhooks vía Cloud Functions — ya existe infraestructura de Functions por las notificaciones push).
- [ ] Lógica de "plan" del usuario en Firestore + gating de features en el cliente.
- [ ] Página de precios.

## Fase 3 — Producto — mejoras próximas

- [ ] **Inglés en la interfaz** (i18n de textos) — prioridad alta, esfuerzo medio.
- [ ] **Metas de ahorro** — meta con monto objetivo + fecha opcional, barra de progreso, aportes manuales o automáticos. No requiere arquitectura nueva, se apoya en el mismo patrón que `categoryBudgets`.
- [ ] Deudas y préstamos (ya estaba pendiente en el proyecto original, nunca se construyó).
- [ ] Voz en inglés — separado y más grande que la traducción de interfaz (parser de NLP nuevo). Queda para después de validar que hay demanda del mercado en inglés.

## Fase 4 — Distribución

- [ ] Dominio propio (hoy es `alberthoma.github.io/Foresee`).
- [ ] Landing page de ventas (hoy no existe — la app misma es la única puerta de entrada, va directo al login).
- [ ] Analítica de producto (hoy no hay ninguna, a propósito — hay que decidir una herramienta que respete la promesa de privacidad ya hecha en los Términos).
- [ ] **Google Play vía TWA** (Bubblewrap o PWABuilder) — bajo costo/riesgo dado que ya existe manifest + service worker.
- [ ] Apple App Store — dejar para después de tener tracción; más costoso y con riesgo real de rechazo en revisión (regla 4.2 de Apple sobre apps que son "solo un sitio web envuelto").

---

## Decisiones pendientes de Alberto
- Confirmar o ajustar el posicionamiento de nicho (español/privacidad primero, inglés como expansión) antes de fijar precio final.
- Compartir las reglas actuales de Firestore para la revisión de seguridad (Fase 0).
- Elegir abogado/contador y avanzar Fase 1 en paralelo a Fase 0 — no dependen una de la otra.
