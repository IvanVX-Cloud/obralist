// =====================================================================
// legal.js — Política de privacidad y Términos y condiciones.
//
// Son dos pantallas de sólo lectura (#/privacidad y #/terminos). Se pueden abrir sin
// cuenta, y se enlazan desde Más (abajo) y desde el formulario de "Crear cuenta".
//
// Cada documento es una lista de secciones: [título, [párrafos o listas]].
// Un párrafo es un texto; una lista es un arreglo de textos (se dibuja con viñetas).
// Si cambia lo que hace la app (por ejemplo, si se agrega algo que guarda más datos),
// hay que actualizar estos textos y la fecha de abajo.
// =====================================================================
import { icono } from "../iconos.js";
import { SOPORTE } from "../config.js";
import { seguro } from "../ui.js";

const ACTUALIZADO = "18 de noviembre de 2026";
const CORREO = seguro(SOPORTE.correo);

const PRIVACIDAD = [
  ["En pocas palabras", [
    "ObraList es una herramienta para llevar listas de materiales, compras, ventas y gastos. Esta política explica qué datos guarda, para qué, con quién se comparten y qué puedes hacer con ellos.",
    [
      "Sin cuenta, tus datos se quedan sólo en tu dispositivo. Nosotros no los recibimos.",
      "Con cuenta, guardamos una copia en la nube para que no la pierdas y la uses en otros dispositivos.",
      "No vendemos tus datos, no mostramos publicidad y no usamos rastreadores ni estadísticas de uso.",
      "No usamos cookies.",
    ],
  ]],
  ["Quién es responsable", [
    "ObraList es una aplicación en versión beta hecha en Costa Rica. Para cualquier consulta sobre tus datos escríbenos a " +
      `<a href="mailto:${CORREO}">${CORREO}</a>.`,
  ]],
  ["Qué datos guarda", [
    "Sin cuenta: todo lo que escribes en la app (listas, catálogo, proveedores, compras, gastos, ventas, notas de bitácora, fotos, tu nombre y ocupación si los pones) se guarda en el navegador de tu dispositivo.",
    "Con cuenta, además guardamos en la nube:",
    [
      "Tu correo electrónico y tu contraseña. La contraseña se guarda cifrada; nosotros no podemos verla.",
      "Una copia de tus listas, catálogo, proveedores, compras, gastos, ventas y bitácora (el texto).",
      "Las listas que compartes y los correos de las personas a quienes invitas.",
    ],
    "Las fotos de la bitácora todavía no se suben a la nube: se quedan sólo en tu dispositivo.",
    "Escribe en la app sólo lo que necesites. Si anotas datos de otras personas (por ejemplo, el nombre, la dirección o el teléfono de un cliente), tú eres quien decide anotarlos y debes tener permiso para hacerlo.",
  ]],
  ["Para qué los usamos", [
    [
      "Que la app funcione: guardar tus datos, respaldarlos, sincronizarlos entre tus dispositivos y compartir listas.",
      "Atender tus consultas de soporte, si nos escribes.",
    ],
    "No usamos tus datos para publicidad, ni para venderlos, ni para crear perfiles.",
  ]],
  ["Listas compartidas", [
    "Si compartes una lista en vivo, la persona invitada podrá ver y editar esa lista completa, incluyendo lo que tenga anotado (por ejemplo, el nombre del cliente o la dirección). También verá tu correo. No verá nada más de tu cuenta. Puedes dejar de compartir cuando quieras. Comparte sólo con personas de confianza.",
  ]],
  ["Servicios externos que usa la app", [
    "Para funcionar, la app se conecta con estos servicios. Todos reciben, como cualquier página de internet, la dirección IP de tu conexión:",
    [
      "Supabase: guarda las cuentas y la copia en la nube (sólo si creas una cuenta). Sus servidores están en Estados Unidos, así que tus datos de la nube se guardan fuera de Costa Rica.",
      "GitHub Pages: es donde está publicada la app.",
      "jsDelivr: entrega una librería que la app necesita para conectarse con Supabase.",
      "Servicios de tipo de cambio (Hacienda de Costa Rica y open.er-api.com): para mostrar el precio del dólar. No les enviamos ningún dato tuyo.",
    ],
    "Cada servicio tiene sus propias políticas de privacidad.",
  ]],
  ["Cookies y almacenamiento en tu dispositivo", [
    "ObraList no usa cookies. Sí usa el almacenamiento del navegador (localStorage, IndexedDB y la caché de la app) para guardar tus datos, recordar tus preferencias, mantener tu sesión y funcionar sin internet. No se usa para rastrearte, y no hay nada que aceptar o rechazar. Si borras los datos del sitio en tu navegador, se borra lo que no hayas respaldado.",
  ]],
  ["Cómo protegemos tus datos", [
    [
      "La conexión con la app y con la nube va cifrada (HTTPS).",
      "En la nube, cada cuenta sólo puede ver y cambiar sus propias filas. Esto lo exige la propia base de datos, no sólo la app.",
      "Las contraseñas se guardan cifradas.",
    ],
    "Ningún sistema es 100 % seguro. Además, lo que está en tu dispositivo y los archivos de respaldo que descargas no van cifrados: protege tu celular con bloqueo de pantalla y guarda tus respaldos en un lugar seguro. Usa una contraseña larga y que no uses en otros sitios.",
  ]],
  ["Tus derechos", [
    "Tienes derecho a saber qué datos tuyos tenemos, a corregirlos, a pedir que los eliminemos y a retirar tu consentimiento, como lo establece la Ley 8968 de Protección de la Persona frente al tratamiento de sus datos personales, de Costa Rica. Puedes:",
    [
      "Ver y corregir tus datos directamente en la app.",
      "Descargar una copia en Más, en «Respaldo».",
      "Borrar todo lo que hay en tu dispositivo con «Borrar todo», en Más.",
      `Pedir que eliminemos tu cuenta y la copia que está en la nube, escribiéndonos a <a href="mailto:${CORREO}">${CORREO}</a> desde el correo de tu cuenta.`,
    ],
  ]],
  ["Cuánto tiempo los guardamos", [
    "Guardamos tus datos mientras tengas tu cuenta. Si pides eliminarla, borramos tu cuenta y tu copia en la nube. Los datos que están sólo en tu dispositivo los controlas tú.",
  ]],
  ["Menores de edad", [
    "ObraList no está pensada para menores de edad. Si crees que un menor creó una cuenta, escríbenos y la eliminamos.",
  ]],
  ["Cambios a esta política", [
    "Si cambiamos algo importante, lo avisaremos en la app. La fecha de abajo muestra la última actualización.",
  ]],
];

const TERMINOS = [
  ["Aceptación", [
    "Al usar ObraList o crear una cuenta aceptas estos términos y la Política de privacidad. Si no estás de acuerdo, no uses la app.",
  ]],
  ["Qué es ObraList", [
    "ObraList es una herramienta para organizar listas de materiales o productos, compras, ventas y gastos. Está en versión beta: puede tener errores, cambiar o tener cortes sin aviso.",
  ]],
  ["Tu cuenta", [
    [
      "Puedes usar la app sin cuenta. La cuenta sirve para respaldar y sincronizar tus datos en la nube.",
      "Debes ser mayor de edad y dar un correo que sea tuyo.",
      "Eres responsable de cuidar tu contraseña y de lo que se haga con tu cuenta.",
    ],
  ]],
  ["Tus datos", [
    "Lo que escribes en la app es tuyo. Nos autorizas únicamente a guardarlo, copiarlo y sincronizarlo para darte el servicio. Eres responsable de lo que anotas, incluidos los datos de otras personas, y de tener permiso para hacerlo.",
  ]],
  ["Uso permitido", [
    "No uses la app para actividades ilegales, para intentar entrar a cuentas o datos de otras personas, ni para dañar o sobrecargar el servicio.",
  ]],
  ["Listas compartidas", [
    "Quien comparte una lista decide con quién y es responsable de esa decisión. La persona invitada puede ver y editar esa lista.",
  ]],
  ["Precios, cálculos y respaldos", [
    [
      "Los precios del catálogo son de ejemplo y aproximados. No son ofertas ni cotizaciones de ninguna tienda. Edítalos con tus precios reales.",
      "Los totales, ganancias, presupuestos y gráficos son una ayuda. Verifícalos antes de tomar decisiones o de cobrar.",
      "ObraList no es un sistema contable ni de facturación, y no da asesoría legal, fiscal ni profesional. No reemplaza la factura electrónica ni tus obligaciones con Hacienda.",
      "Haz respaldos de vez en cuando (Más, en «Respaldo»). No garantizamos que tus datos estén siempre disponibles.",
    ],
  ]],
  ["Límite de responsabilidad", [
    "ObraList se ofrece «tal cual», gratis y en versión beta, sin garantías. En la medida en que la ley lo permita, no somos responsables por pérdidas de datos, de dinero o de oportunidades causadas por usar la app, por errores o por cortes del servicio. Esto no limita los derechos que la ley te reconoce como consumidor.",
  ]],
  ["Terminar el uso", [
    `Puedes dejar de usar la app cuando quieras y pedir que eliminemos tu cuenta escribiendo a <a href="mailto:${CORREO}">${CORREO}</a>. Podemos suspender cuentas que incumplan estos términos.`,
  ]],
  ["Cambios", [
    "Podemos cambiar estos términos. Si el cambio es importante, lo avisaremos en la app. Si sigues usándola después, entendemos que los aceptas.",
  ]],
  ["Ley aplicable y contacto", [
    `Estos términos se rigen por las leyes de Costa Rica. Para cualquier consulta, escríbenos a <a href="mailto:${CORREO}">${CORREO}</a>.`,
  ]],
];

// Dibuja un documento: título, fecha y una tarjeta por sección.
function documento(titulo, iconoNombre, secciones) {
  const bloque = (x) => Array.isArray(x)
    ? `<ul class="lista-legal">${x.map((li) => `<li>${li}</li>`).join("")}</ul>`
    : `<p>${x}</p>`;
  return `
    <a class="volver" href="#/mas">${icono("volver")}Volver a Más</a>
    <div class="encabezado"><h2>${icono(iconoNombre)}${titulo}</h2></div>
    <p class="nota">ObraList · Versión beta · Última actualización: ${ACTUALIZADO}</p>
    ${secciones.map(([t, cuerpo]) => `
      <section class="tarjeta legal">
        <h3>${t}</h3>
        ${cuerpo.map(bloque).join("")}
      </section>`).join("")}
    <p class="nota centro"><a href="#/privacidad">Política de privacidad</a> · <a href="#/terminos">Términos y condiciones</a></p>`;
}

export const vistaPrivacidad = {
  tab: "mas",
  render: () => documento("Política de privacidad", "candado", PRIVACIDAD),
};

export const vistaTerminos = {
  tab: "mas",
  render: () => documento("Términos y condiciones", "info", TERMINOS),
};
