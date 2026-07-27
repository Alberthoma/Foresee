// Foresee 2.0 — section-help.js
// Contenido del modal "¿Cómo funciona esta sección?", accesible desde
// el botón permanente de #action-bar en cualquier pestaña. Es material
// de apoyo aparte del tutorial en video — texto para el usuario final,
// no documentación técnica.
import { openModal, closeModal } from "./ui.js";

const SECTION_HELP = {
  registros: {
    title: "Registros",
    lede: "El libro diario de ingresos y gastos reales — el corazón de toda la app. Todo lo demás (saldo, reportes, presupuesto, proyección) se construye a partir de lo que registras aquí.",
    steps: [
      "Presiona “+ Registrar” para abrir la calculadora.",
      "Elige Ingreso o Gasto.",
      "Escribe el monto (admite operaciones simples como “12+8”) y una descripción.",
      "Elige la fecha y el banco donde ocurrió el movimiento.",
      "Si tienes el recibo a mano, usa “📷 Escanear recibo” en vez de escribir a mano.",
      "Presiona “✓ Listo” y elige la categoría para guardar — es obligatoria.",
    ],
    simulacro: "Gastaste $45 en el supermercado con “Cuenta Corriente”: + Registrar → Gasto → 45 → “Supermercado” → hoy → Cuenta Corriente → ✓ Listo → categoría “Alimentación” → Guardar. Tu saldo corrido baja $45 al instante, y ese gasto ya cuenta en Presupuesto y Reportes.",
    conexiones: "Alimenta el Dashboard, Saldos, Reportes, Presupuesto y Proyección — es la fuente de la que beben las otras 11 secciones.",
  },
  voz: {
    title: "Voz",
    lede: "La forma más rápida de registrar algo cuando tienes las manos ocupadas: le hablas a la app en español normal y ella entiende qué fue, cuánto costó y en qué categoría entra.",
    steps: [
      "Presiona el botón del micrófono (funciona mejor en Chrome de escritorio).",
      "Habla con naturalidad, por ejemplo: “Gasté 15 dólares con 45 centavos en gasolina ayer”.",
      "Di la palabra “guardar” al terminar — detiene la grabación y dispara el análisis.",
      "Revisa el panel con lo que entendió (tipo, monto, fecha, descripción, categoría, banco) — todo es editable antes de guardar.",
      "Presiona “Guardar”, o “Nueva” para dictar otra transacción.",
    ],
    simulacro: "Presionas el micrófono y dices: “Pagué 20 dólares en Netflix guardar”. La app detecta “pagué” (gasto), el monto $20, y asocia “Netflix” con tu categoría “Entretenimiento”. Se abre el panel de confirmación pre-rellenado; ajustas el banco si hace falta y presionas Guardar.",
    conexiones: "Guarda en el mismo lugar que Registros — comparte tus categorías, bancos y descripciones.",
  },
  proyeccion: {
    title: "Proyección",
    lede: "Responde la pregunta que de verdad importa: si nada cambia, ¿cómo va a terminar mi mes? Combina tus transacciones reales con estimaciones tuyas y con los recurrentes que aún no llegan a su fecha.",
    steps: [
      "La tabla mezcla filas reales, estimaciones tuyas y filas “virtuales” que la app genera sola a partir de tus recurrentes (marcadas “proyectado”).",
      "Presiona “+ Proyección” para agregar una estimación tuya — el formulario es igual al de Registros, pero guarda aparte, no en tus transacciones reales.",
      "Activa “Ver también el mes siguiente” si quieres mirar más adelante.",
    ],
    simulacro: "Sabes que en dos semanas vas a tener un gasto médico de $200 que aún no ocurrió. + Proyección → Gasto → $200 → fecha en dos semanas → “Salud” → Guardar. Esa fila aparece junto a tus recurrentes ya proyectados. Si el saldo final proyectado da negativo, ya lo sabes con anticipación.",
    conexiones: "Usa el mismo motor de saldo que Registros y Saldos, y lee tus Gastos Recurrentes para generar las filas virtuales.",
  },
  recurrentes: {
    title: "Gastos Recurrentes",
    lede: "Para los pagos que se repiten mes a mes: una suscripción, el alquiler, un servicio. Los defines una sola vez y la app los registra sola cada mes, además de avisarte antes de que venzan.",
    steps: [
      "Presiona “+ Añadir”.",
      "Completa descripción, categoría, banco, el monto que pagas tú, y el día del mes en que se cobra.",
      "Si es un gasto compartido donde el banco cobra un total distinto a lo que tú aportas, completa el campo opcional “Monto total cobrado por el banco”.",
      "Guarda — no tienes que volver a tocar nada, el resto es automático.",
    ],
    simulacro: "Configuras “Alquiler”, categoría “Vivienda”, banco “Cuenta Corriente”, $800, día de pago 1. El día 1 de cada mes aparece solo en Registros “Alquiler ®” por $800. Tres días antes, ves en el Dashboard: “Alquiler vence en 3 días”.",
    conexiones: "Sus registros automáticos aparecen en Registros, Saldos y Reportes, y alimentan las filas proyectadas de Proyección.",
  },
  "gastos-comunes": {
    title: "Gastos Comunes",
    lede: "Para cuando un gasto se paga entre varias personas — alquiler compartido, una cena de grupo — y necesitas saber cuánto le toca a cada quien y quién ya pagó.",
    steps: [
      "Presiona “+ Añadir”: nombre del gasto y monto total.",
      "Agrega a las personas involucradas con el botón “+”.",
      "Para cada persona eliges cómo se calcula su parte: partes iguales del monto que quede, un porcentaje, o un monto fijo — el cálculo es en cascada, el orden importa.",
      "Cuando alguien paga, escribe el día y presiona “OK”, elige el banco donde recibiste el dinero — la app crea automáticamente un ingreso en Registros.",
    ],
    simulacro: "La renta de julio es $900, compartida con Ana y Luis. “Renta julio” con $900. Ana: “Porcentaje 30%” ($270). Cuando Ana transfiere su parte, marcas su fila día 3 → OK → banco. Aparece un ingreso de $270 en Registros como “Ana - Renta julio”, sin que lo registres a mano.",
    conexiones: "Los pagos se vuelven ingresos reales en Registros, Saldos y Reportes.",
  },
  tarjetas: {
    title: "Tarjetas y Préstamos",
    lede: "Control de cualquier deuda con cuotas e interés — tarjetas o préstamos. Sabes cuánto te costaría pagarla en el plazo que elijas y cuánto te queda disponible antes del límite.",
    steps: [
      "Presiona “+ Añadir”: nombre, monto que debes hoy, línea de crédito, día de pago, interés anual, y meses para saldarla.",
      "Cada campo es editable directamente en la tarjeta — se guarda solo al salir de él.",
      "La app calcula tu Pago Mensual Estimado: la cuota fija para saldar la deuda en el plazo elegido, considerando el interés.",
      "Si una tarjeta no debe contar en tus totales generales, marca su checkbox “Excluir”.",
    ],
    simulacro: "Tienes $3,000 de deuda, línea de $5,000, interés anual 24%, y quieres pagarla en 12 meses. La app muestra un pago mensual estimado de ~$283, y que ya usaste el 60% de tu línea. Al llegar al 80% de uso, el Dashboard te avisa.",
    conexiones: "Si eliminas en Configuración un banco con tarjeta asociada, esa tarjeta se elimina con él. Sus alertas aparecen en el Dashboard.",
  },
  metas: {
    title: "Metas de Ahorro",
    lede: "Convierte un objetivo de ahorro (“quiero juntar $2,000 para un viaje”) en algo visible, con progreso y fecha, en vez de una intención que se diluye con el tiempo.",
    steps: [
      "Presiona “+ Nueva Meta”: nombre, monto objetivo, cuánto llevas ahorrado (opcional) y, si quieres, una fecha objetivo.",
      "Cada vez que ahorres algo, entra a la tarjeta y edita el campo “Ahorrado” sumando el nuevo monto.",
      "La tarjeta muestra progreso, cuánto falta y cuántos días quedan (o si ya cumpliste la meta 🎉).",
    ],
    simulacro: "Creas “Fondo de emergencia”, objetivo $3,000, $0 ahorrado. Este mes apartas $150 y cambias “Ahorrado” a $150 — la barra pasa a 5%. El mes siguiente lo subes a $300, y así hasta llegar al 100%.",
    conexiones: "No se conecta con ninguna otra sección: actualizar “Ahorrado” no crea ninguna transacción ni descuenta de ningún banco — es un dato manual de seguimiento.",
  },
  saldos: {
    title: "Saldos",
    lede: "Cuánto dinero tienes en cada banco por separado, no solo el total general — útil si manejas varias cuentas.",
    steps: [
      "Es de solo lectura, no hay nada que crear aquí.",
      "Ves una tarjeta por cada banco configurado, con su saldo neto y su número de movimientos.",
      "Al final, una tarjeta de Balance Total suma tu saldo inicial más el neto de todos los bancos.",
    ],
    simulacro: "Tienes “Cuenta Corriente” y “Ahorros”. Transfieres $200 de Corriente a Ahorros. En Saldos, Corriente baja $200 y Ahorros sube $200 — el Balance Total no cambia, porque el dinero solo se movió de lugar.",
    conexiones: "Usa el mismo motor de cálculo que Registros y Proyección, así que el número siempre coincide entre secciones.",
  },
  reportes: {
    title: "Reportes",
    lede: "Entender de un vistazo visual hacia dónde se va tu dinero. Aquí los datos que registraste se convierten en información útil para decidir.",
    steps: [
      "Filtras por mes y aparecen siete bloques: Tasa de Ahorro, Gastos por Categoría (dona), Flujo de Caja de 6 meses, Evolución del Saldo, Recurrentes vs. Variables, Gasto por Día del Mes y Comparativa vs. Mes Anterior.",
      "Toca una porción de la dona o su leyenda para ver el detalle de cada transacción de esa categoría.",
      "Más abajo, un Resumen Anual muestra ingresos y gastos mes a mes en lo que va del año.",
    ],
    simulacro: "Terminando el mes ves que tu Tasa de Ahorro fue del 12%. En la dona, “Alimentación” ocupa el 35% — más de lo esperado. Tocas esa porción y ves tres pedidos de comida a domicilio que suman más de lo que pensabas.",
    conexiones: "Lee directamente tus Registros y Recurrentes, y los meses archivados (los cerrados con “Iniciar Nuevo Mes”) para mostrar comparativas históricas.",
  },
  presupuesto: {
    title: "Presupuesto",
    lede: "Ponle un límite a cuánto quieres gastar por categoría cada mes, y ve en tiempo real cuánto llevas gastado y cuánto te queda — antes de que sea tarde para frenar.",
    steps: [
      "Escribe el monto que quieres presupuestar en cada categoría — se guarda al salir del campo.",
      "Junto a cada categoría verás cuánto ya gastaste, cuánto te queda disponible, y una barra que se pone amarilla al 80% y roja al 100%.",
      "Al cruzar el 80% recibes un aviso; al 90%, uno más urgente — una sola vez por categoría por mes.",
    ],
    simulacro: "Le pones $300 a “Alimentación”. A mitad de mes ya llevas $250 (83%) — la barra se pone amarilla y recibes el aviso. Decides cocinar más en casa el resto del mes.",
    conexiones: "Depende de las categorías de Configuración y de tus transacciones reales en Registros.",
  },
  configuracion: {
    title: "Configuración",
    lede: "El centro de administración de toda tu cuenta: catálogos base que usan las demás secciones, seguridad, notificaciones, y respaldo/exportación de tus datos.",
    steps: [
      "Categorías y Bancos/Cuentas — la base que usan Registros, Voz, Recurrentes, Tarjetas y Presupuesto.",
      "Tu nombre, cambio de contraseña, Saldo Inicial y Divisa.",
      "Notificaciones (navegador, correo y push), Apariencia (claro/oscuro).",
      "Iniciar Nuevo Mes, Exportar/Importar (JSON, PDF, Excel), y Zona de Peligro.",
    ],
    simulacro: "Terminaste de explorar con datos de ejemplo y quieres empezar en serio: Zona de Peligro → Reiniciar Período → revisas tus categorías y bancos reales → cargas tu Saldo Inicial real → activas notificaciones → listo para registrar tu vida financiera real.",
    conexiones: "Es la base de la que dependen casi todas las secciones: sin categorías y bancos definidos aquí, varias no tienen de dónde elegir.",
  },
  importar: {
    title: "Importar",
    lede: "Para no tipear a mano decenas de movimientos de un extracto bancario: subes el archivo (o una foto) y la app hace la mayor parte del trabajo, dejándote revisar antes de confirmar.",
    steps: [
      "Arrastra o selecciona el archivo — CSV, Excel, o una foto del extracto (beta).",
      "En CSV/Excel, la app detecta el banco por el nombre del archivo — si no lo reconoce, te pide renombrarlo.",
      "Revisa la vista previa editable: fecha, descripción, categoría (la asignas tú), banco y monto. Las filas con ⚠️ son posibles duplicados.",
      "Presiona “Guardar en Registros” — si una fila coincide con un recurrente ya auto-registrado, lo reemplaza por el real importado.",
    ],
    simulacro: "Descargas el extracto de julio, lo renombras a “WellsFargo-Julio.csv” y lo arrastras a Importar. La vista previa muestra 40 movimientos, 3 con ⚠️. Deseleccionas duplicados, asignas categoría a los que faltan, y “Guardar en Registros” te avisa: “34 importadas, 3 omitidas por duplicado”.",
    conexiones: "Escribe en el mismo lugar que Registros y Voz, y coordina con Recurrentes para no dejar registros duplicados.",
  },
};

function buildBody(container, data) {
  container.textContent = "";

  const lede = document.createElement("p");
  lede.className = "shm-lede";
  lede.textContent = data.lede;
  container.appendChild(lede);

  const stepsHeading = document.createElement("h4");
  stepsHeading.className = "shm-heading";
  stepsHeading.textContent = "Cómo se usa";
  container.appendChild(stepsHeading);

  const ol = document.createElement("ol");
  ol.className = "shm-steps";
  data.steps.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    ol.appendChild(li);
  });
  container.appendChild(ol);

  const sim = document.createElement("div");
  sim.className = "shm-simulacro";
  const simTag = document.createElement("span");
  simTag.className = "shm-tag";
  simTag.textContent = "Simulacro";
  const simP = document.createElement("p");
  simP.textContent = data.simulacro;
  sim.append(simTag, simP);
  container.appendChild(sim);

  const con = document.createElement("div");
  con.className = "shm-conexiones";
  const conTag = document.createElement("span");
  conTag.className = "shm-tag shm-tag--muted";
  conTag.textContent = "Se conecta con";
  const conP = document.createElement("p");
  conP.textContent = data.conexiones;
  con.append(conTag, conP);
  container.appendChild(con);
}

export function openSectionHelp(sectionKey) {
  const data = SECTION_HELP[sectionKey];
  if (!data) return;
  document.getElementById("section-help-title").textContent = data.title;
  buildBody(document.getElementById("section-help-body"), data);
  openModal("section-help-modal");
}

export function initSectionHelp() {
  document.getElementById("section-help-close").addEventListener("click", () => closeModal("section-help-modal"));
  document.getElementById("section-help-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal("section-help-modal");
  });
}
