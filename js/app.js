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
import { $, alRefrescar, aplicarApariencia, recordarDesplegable } from "./ui.js";
import { icono } from "./iconos.js";
import { vistaListas, vistaLista } from "./vistas/listas.js";
import { vistaCatalogo } from "./vistas/catalogo.js";
import { vistaGastos } from "./vistas/gastos.js";
import { vistaMas } from "./vistas/mas.js";
import { vistaCalculadoras } from "./vistas/calculadoras.js";
import { vistaBitacora } from "./vistas/bitacora.js";
import { iniciarInstalacion } from "./instalar.js";
import { iniciarNube } from "./nube.js";

const VISTAS = {
  listas: vistaListas,
  lista: vistaLista,
  catalogo: vistaCatalogo,
  historial: vistaGastos, // la antigua pantalla "Compras" ahora está dentro de Gastos
  gastos: vistaGastos,
  mas: vistaMas,
  calculadoras: vistaCalculadoras,
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
}

alRefrescar(render);
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

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

// Íconos del HTML fijo (pestañas, botón instalar): <span data-icono="listas">
document.querySelectorAll("[data-icono]").forEach((el) => { el.outerHTML = icono(el.dataset.icono); });

aplicarApariencia();
render();

// ---------- PWA: instalar en el celular (ver instalar.js) ----------
iniciarInstalacion();

// ---------- Cuenta en la nube (ver nube.js) ----------
iniciarNube();
