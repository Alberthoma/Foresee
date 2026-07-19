# Plan de Comercialización — Foresee 2.0

**Creado:** 2026-07-18 · **Última reordenación:** 2026-07-18
**Contexto:** el usuario (Alberto) quiere comercializar Foresee 2.0. Vive en Estados Unidos. Precio sin definir todavía — se estimará por comparación con el mercado (ver "Posicionamiento"). Este documento es la referencia viva del plan, se actualiza a medida que se ejecuta cada punto.

**Orden:** los números del checklist son el orden real de trabajo, elegido por Alberto — no siguen el orden en que se agruparon los temas al principio (Seguridad / Legal / Monetización / Producto / Distribución siguen apareciendo como etiqueta entre paréntesis, solo para referencia rápida). Alberto puede reordenar en cualquier momento — pedirle a Claude que renumere.

---

## Posicionamiento — la decisión central de la que depende todo lo demás

Foresee **no compite de igual a igual** con Mint/YNAB/Monarch/Copilot: esas apps ganan por la sincronización automática con el banco (Plaid), algo que Foresee no tiene y que es caro/complejo de agregar.

Foresee tiene dos ventajas reales que esas apps no ofrecen:
1. **No requiere vincular credenciales bancarias a un tercero** — todo es entrada manual, foto (OCR) o CSV.
2. **Español nativo, con voz en español natural** (`voice-parser.js`) — ninguna app grande de EE.UU. lo ofrece.

Sumado a que Alberto quiere agregar **inglés** próximamente (la app ya soporta múltiples monedas, lo que confirma una ambición más amplia que un solo idioma), el posicionamiento recomendado es:

> **Foresee es la app de finanzas personales bilingüe (ES/EN) para quienes no quieren o no pueden vincular su cuenta bancaria a un tercero** — con foco inicial en la comunidad hispanohablante de EE.UU. (40M+ personas, tasa de "unbanked/underbanked" más alta que el promedio según la FDIC), expandible a mercado general bilingüe.

Este posicionamiento decide el precio, qué features priorizar, y qué mensaje de marketing usar.

---

## Checklist — orden de trabajo

1. **(Seguridad)** ✅ Reglas de Firestore traídas al repo como código (`firestore.rules`, `firebase.json`, `.firebaserc`) y revisadas — el aislamiento entre usuarios está bien: nadie puede leer/escribir datos de otro usuario.
2. **(Seguridad)** ✅ `{appId}` fijado a `wittfinances-282f1` en la regla (ya no acepta cualquier valor) — pendiente: pegar esta versión en Firebase Console → Firestore → Reglas y publicarla, hoy solo existe en el repo.
3. **(Seguridad)** Agregar Firebase App Check — evita que bots/scripts golpeen Firestore/Cloud Functions simulando ser la app real.
4. **(Seguridad)** Evaluar exigir verificación de email al registrarse (`sendEmailVerification`) — hoy no existe.
5. **(Seguridad)** Confirmar plan de facturación de Firebase (Blaze) y poner alertas de presupuesto en Google Cloud Console.
6. **(Producto)** Inglés en la interfaz (i18n de textos) — prioridad alta, esfuerzo medio.
7. **(Producto)** Metas de ahorro — meta con monto objetivo + fecha opcional, barra de progreso, aportes manuales. Se apoya en el mismo patrón que `categoryBudgets`, sin arquitectura nueva.
8. **(Producto)** Deudas y préstamos (pendiente desde el proyecto original, nunca se construyó).
9. **(Producto)** Voz en inglés — parser de NLP nuevo, separado y más grande que la traducción de interfaz. Después de validar demanda en inglés.
10. **(Distribución)** Landing page de ventas (hoy no existe — la app va directo al login).
11. **(Distribución)** Analítica de producto — con una herramienta que respete la promesa de privacidad ya hecha en los Términos.
12. **(Legal)** Consultar abogado/contador en EE.UU.: figura legal para cobrar (LLC vs. persona individual), impuestos, cumplimiento normativo.
13. **(Legal)** Redactar Términos de Servicio y Política de Privacidad reales (los actuales en `index.html` son un placeholder — dicen "no autorizado para uso comercial", hay que reemplazarlos antes de cobrar).
14. **(Legal)** Definir política de reembolsos/cancelación antes de activar cobros.
15. **(Monetización)** Diseñar el modelo de planes — **freemium recomendado**: entrada manual ilimitada gratis; nivel pago (~$4.99–6.99/mes o ~$40–50/año) desbloquea OCR de recibos/extractos, exportar Excel/PDF, gastos comunes multi-persona.
16. **(Monetización)** Integrar Stripe (Checkout + Webhooks vía Cloud Functions — ya existe infraestructura de Functions por las notificaciones push).
17. **(Monetización)** Lógica de "plan" del usuario en Firestore + gating de features en el cliente.
18. **(Monetización)** Página de precios.
19. **(Distribución)** Dominio propio (hoy es `alberthoma.github.io/Foresee`).
20. **(Distribución)** Google Play vía TWA (Bubblewrap o PWABuilder) — bajo costo/riesgo, ya existe manifest + service worker.
21. **(Distribución)** Apple App Store — más costoso, riesgo real de rechazo en revisión (regla 4.2 de Apple).

**Pendiente — Detalle menor de seguridad, a propósito al final:** validar la *forma* de los datos en las reglas de Firestore (hoy solo valida *quién* escribe, no *qué* escribe). No es una fuga entre usuarios, es integridad de datos — se deja para el final porque requiere revisar campo por campo cada módulo (`registros.js`, `recurrentes.js`, `tarjetas.js`, etc.) sin arriesgar romper guardados legítimos en producción.

---

## Decisiones pendientes de Alberto
- Confirmar el posicionamiento de nicho (español/privacidad primero, inglés como expansión) antes de fijar precio final.
- Publicar en Firebase Console la regla con `appId` fijo (punto 2) — hoy solo está en el repo.
- Revisar y ajustar el orden del checklist si cambia alguna prioridad.
