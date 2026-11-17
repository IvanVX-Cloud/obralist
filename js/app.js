// =====================================================================
// app.js — Punto de entrada. Decide qué pantalla mostrar (enrutador)
// y reparte los clics/cambios a la pantalla activa.
//
// Cada pantalla (vista) es un objeto con:
//   render(param)  → devuelve el HTML de la pantalla
//   acciones       → funciones para clics en elementos con data-accion="..."
//   cambios        → para <select>/<input> con data-cambio="..."
//   entradas       → mientras se escribe, en elementos con data-entrada="..."
//   formularios    → al enviar un <form data-form="...">
// =====================================================================
import { $, alRefrescar, aplicarApariencia, recordarDesplegable, descargar, aviso, seguro, activarVerContrasena } from "./ui.js";
import { db, errorAlGuardar, esFaltaDeEspacio } from "./datos.js";
import { SOPORTE } from "./config.js";
import { icono } from "./iconos.js";
import { vistaListas, vistaLista } from "./vistas/listas.js";
import { vistaCatalogo } from "./vistas/catalogo.js";
import { vistaGastos } from "./vistas/gastos.js";
import { vistaMas } from "./vistas/mas.js";
import { vistaBitacora } from "./vistas/bitacora.js";
import { guiaSiEsNueva } from "./guia.js";
import { iniciarInstalacion } from "./instalar.js";
import { iniciarNube } from "./nube.js";
import { iniciarTipoCambio } from "./tipocambio.js";

const VISTAS = {
  listas: vistaListas,
  lista: vistaLista,
  catalogo: vistaCatalogo,
  historial: vistaGastos, // la antigua pantalla "Compras" ahora está dentro de Gastos
  gastos: vistaGastos,
  mas: vistaMas,
  bitacora: vistaBitacora,
};

let actual = vistaListas;

function render() {
  // "#/lista/abc123" → nombre = "lista", param = "abc123"
  const [nombre, param] = location.hash.replace(/^#\/?/, "").split("/");
  actual = VISTAS[nombre] || vistaListas;
  $("#vista").innerHTML = actual.render(param ? decodeURIComponent(param) : undefined);
  actual.despues?.(); // algunas pantallas cargan cosas después de dibujarse (ej. fotos)
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("activa", a.dataset.tab === actual.tab));
  saludoDeLaBarra();
}

// El saludo vive en la franja naranja de arriba y sólo se ve en el inicio (Listas),
// cuando la persona ya puso su nombre en "Mi cuenta".
function saludoDeLaBarra() {
  const saludo = $("#saludoBarra");
  const { nombre, ocupacion } = db.perfil;
  saludo.hidden = !(actual === vistaListas && nombre);
  if (saludo.hidden) return;
  saludo.innerHTML = `Hola, <strong>${seguro(nombre.split(" ")[0])}</strong>`
    + (ocupacion ? ` <span class="etiqueta-oficio">${seguro(ocupacion)}</span>` : "");
}

alRefrescar(render);
// Al cambiar de pantalla se anima la entrada (clase "entrando"). Al tocar algo dentro
// de la misma pantalla NO se anima: si no, todo parpadea y el toque puede fallar.
window.addEventListener("hashchange", () => {
  const v = $("#vista");
  v.classList.add("entrando");
  render();
  window.scrollTo(0, 0);
  setTimeout(() => v.classList.remove("entrando"), 300);
});

// ---------- Delegación de eventos: un escuchador para toda la pantalla ----------
const vista = $("#vista");

vista.addEventListener("click", (e) => {
  const el = e.target.closest("[data-accion]");
  const f = el && actual.acciones?.[el.dataset.accion];
  if (!f) return;
  if (el.tagName === "BUTTON" || el.tagName === "A") e.preventDefault();
  f(el, e);
});

vista.addEventListener("change", (e) => {
  const el = e.target.closest("[data-cambio]");
  const f = el && actual.cambios?.[el.dataset.cambio];
  if (f) f(el, e);
});

vista.addEventListener("input", (e) => {
  const el = e.target.closest("[data-entrada]");
  const f = el && actual.entradas?.[el.dataset.entrada];
  if (f) f(el, e);
});

// "toggle" no burbujea, por eso se escucha en fase de captura (el true del final).
vista.addEventListener("toggle", (e) => {
  const d = e.target;
  if (!d.dataset?.plegable) return;
  if (d.dataset.auto) { delete d.dataset.auto; return; } // lo abrió la búsqueda, no el usuario
  recordarDesplegable(d.dataset.plegable, d.open);
}, true);

vista.addEventListener("submit", (e) => {
  const form = e.target.closest("form[data-form]");
  const f = form && actual.formularios?.[form.dataset.form];
  if (!f) return;
  e.preventDefault();
  f(form, Object.fromEntries(new FormData(form)), e); // e.submitter = botón que se tocó
});

activarVerContrasena(); // botón de ojo en todos los campos de contraseña

// Íconos del HTML fijo (pestañas, botón instalar): <span data-icono="listas">
document.querySelectorAll("[data-icono]").forEach((el) => { el.outerHTML = icono(el.dataset.icono); });

// ---------- Aviso cuando no se pudo guardar (ver "guardar" en datos.js) ----------
function mostrarEstadoGuardado() {
  const barra = $("#errorGuardado");
  const e = errorAlGuardar;
  const habiaError = !barra.hidden;
  barra.hidden = !e;
  if (!e) {
    if (habiaError) aviso("Listo: ya se pudo guardar de nuevo");
    return;
  }
  const causa = esFaltaDeEspacio(e)
    ? "El celular no tiene espacio libre para ObraList. Libera espacio (fotos, videos o apps que no uses) o borra fotos viejas de la bitácora."
    : `Este navegador no deja guardar datos (puede ser una ventana privada o de incógnito).${SOPORTE.correo ? ` Si sigue pasando, escribe a ${seguro(SOPORTE.correo)}.` : ""}`;
  barra.innerHTML = `
    ${icono("alerta")}
    <span><strong>No se pudo guardar lo último que hiciste.</strong> ${causa}
      Mientras tanto, descarga un respaldo para no perder nada.</span>
    <button type="button" data-respaldo>${icono("descargar")}Descargar respaldo</button>`;
}

$("#errorGuardado").addEventListener("click", (e) => {
  if (!e.target.closest("[data-respaldo]")) return;
  descargar(`obralist-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(db, null, 2), "application/json");
  aviso("Respaldo descargado. Guárdalo bien.");
});
window.addEventListener("obralist:guardado", mostrarEstadoGuardado);

aplicarApariencia();
render();
mostrarEstadoGuardado(); // por si ya falló al abrir la app
guiaSiEsNueva(); // la primera vez: guía de bienvenida (ver guia.js)

// ---------- PWA: instalar en el celular (ver instalar.js) ----------
iniciarInstalacion();

// ---------- Pedir que el navegador NO borre los datos de ObraList ----------
// Cuando al celular le falta espacio, el navegador puede borrar solo los datos
// de páginas web "que no se usan". Con persist() le pedimos que los de ObraList
// los trate como importantes. En Chrome se concede sin preguntar si la app está
// instalada o se usa seguido; si no, no pasa nada malo.
navigator.storage?.persisted?.().then((ya) => { if (!ya) return navigator.storage.persist(); }).catch(() => {});

// ---------- Cuenta en la nube (ver nube.js) ----------
iniciarNube();

// ---------- Tipo de cambio del dólar (ver tipocambio.js) ----------
iniciarTipoCambio();
