// =====================================================================
// ui.js — Herramientas de interfaz que usan todas las pantallas.
// =====================================================================

import { db, TIPO_CAMBIO_INICIAL } from "./datos.js";
import { icono } from "./iconos.js";

// ---------- Desplegables (secciones que se abren y cierran) ----------
// Se recuerda cuáles abrió o cerró el usuario mientras la app está abierta,
// así al volver a dibujar la pantalla no se cierran solos.
const estadoDesplegables = new Map(); // id → true (abierto) / false (cerrado)
export const recordarDesplegable = (id, abierto) => estadoDesplegables.set(id, abierto);
export const desplegableAbierto = (id, porDefecto = false) =>
  (estadoDesplegables.has(id) ? estadoDesplegables.get(id) : porDefecto);

export function desplegable(id, { titulo, resumen = "", contenido, abierto = false, clase = "" }) {
  return `
    <details class="tarjeta plegable ${clase}" data-plegable="${id}" data-por-defecto="${abierto ? 1 : 0}" ${desplegableAbierto(id, abierto) ? "open" : ""}>
      <summary>
        <span class="plegable-titulo">${titulo}</span>
        ${resumen ? `<span class="plegable-resumen">${resumen}</span>` : ""}
        ${icono("adelante", "flecha")}
      </summary>
      <div class="plegable-contenido">${contenido}</div>
    </details>`;
}

export const $ = (selector) => document.querySelector(selector);

// ---------- Moneda (colones ₡ / dólares $) ----------
// REGLA: todos los montos se GUARDAN en colones. La moneda elegida sólo cambia
// cómo se MUESTRAN y cómo se ESCRIBEN. Así, cambiar de moneda nunca daña tus datos.
export const moneda = () => (db.perfil.moneda === "USD" ? "USD" : "CRC");
// Automático (por defecto): el del BCCR que se consultó; manual: el que escribió el usuario.
export const tipoCambioManual = () => db.perfil.tipoCambioModo === "manual";
export function tipoCambio() {
  if (!tipoCambioManual() && Number(db.perfil.tcAuto?.venta) > 0) return Number(db.perfil.tcAuto.venta);
  return Number(db.perfil.tipoCambio) > 0 ? Number(db.perfil.tipoCambio) : TIPO_CAMBIO_INICIAL;
}
export const simbolo = () => (moneda() === "USD" ? "$" : "₡");

// Colones guardados → número en la moneda elegida (para llenar un campo).
export function aMoneda(colones) {
  const v = moneda() === "USD" ? (Number(colones) || 0) / tipoCambio() : Number(colones) || 0;
  return Math.round(v * 100) / 100;
}

// Número escrito por el usuario en la moneda elegida → colones para guardar.
export function aColones(valor) {
  const v = Number(valor) || 0;
  return moneda() === "USD" ? v * tipoCambio() : v;
}

// Redibuja la pantalla, salvo que el usuario esté escribiendo o tenga una
// ventana abierta (para no borrarle lo que está escribiendo).
export function refrescarSiSePuede() {
  const activo = document.activeElement;
  const escribiendo = activo && /INPUT|TEXTAREA|SELECT/.test(activo.tagName) && activo.closest("#vista");
  if (document.querySelector("#dialogo")?.open || escribiendo) return;
  refrescar();
}

// Al editar: si el usuario no tocó el precio, dejamos el original (evita
// errores de redondeo al convertir de ida y vuelta entre $ y ₡).
export const precioEditado = (escrito, original) =>
  Number(escrito) === aMoneda(original) ? original : aColones(escrito);

export function dinero(colones) {
  const n = Number(colones) || 0;
  return moneda() === "USD"
    ? (n / tipoCambio()).toLocaleString("es-CR", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" })
    : n.toLocaleString("es-CR", { style: "currency", currency: "CRC", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
}

// ---------- Apariencia (tema claro/oscuro y modo obra) ----------
export function aplicarApariencia() {
  const raiz = document.documentElement;
  const tema = db.perfil.tema || "auto";
  if (tema === "auto") delete raiz.dataset.tema;
  else raiz.dataset.tema = tema;
  raiz.classList.toggle("modo-obra", Boolean(db.perfil.modoObra));
}

export function fecha(iso) {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });
}

// Escapa texto antes de meterlo en HTML. Así, si alguien escribe <script>
// como nombre de material, se muestra como texto y no se ejecuta.
export function seguro(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Genera <option> para un <select> a partir de una colección con id.
export function opcionesDe(items, seleccionado, etiqueta = (x) => x.nombre) {
  return items.map((x) => `<option value="${x.id}" ${x.id === seleccionado ? "selected" : ""}>${seguro(etiqueta(x))}</option>`).join("");
}

// ---------- Navegación ----------
// La app usa "rutas" en el hash de la URL: #/listas, #/lista/abc123, #/catalogo…
export const ir = (hash) => { location.hash = hash; };

let funcionRender = () => {};
export const alRefrescar = (f) => { funcionRender = f; };
export const refrescar = () => funcionRender();

// ---------- Aviso flotante ("toast") ----------
let temporizador;
export function aviso(mensaje) {
  const el = $("#aviso");
  el.textContent = mensaje;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- Ventana con formulario ----------
// Uso:  const datos = await formulario({ titulo, campos: [...] });
// Devuelve un objeto con lo que escribió el usuario, o null si canceló.
// `await` espera a que el usuario termine, sin congelar la app (es una Promesa).
export function formulario({ titulo, campos, boton = "Guardar" }) {
  const dlg = $("#dialogo");
  dlg.innerHTML = `
    <form method="dialog" class="formulario">
      <h2>${seguro(titulo)}</h2>
      ${campos.map(campoHtml).join("")}
      <div class="fila fin">
        <button value="cancelar" formnovalidate>Cancelar</button>
        <button value="ok" class="principal">${seguro(boton)}</button>
      </div>
    </form>`;
  dlg.showModal();
  return new Promise((resolver) => {
    const form = dlg.querySelector("form");
    const terminar = (valor) => { dlg.close(); resolver(valor); };
    // Al enviar el formulario: ¿qué botón se tocó? (e.submitter)
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (e.submitter?.value === "cancelar") return terminar(null);
      const datos = Object.fromEntries(new FormData(form));
      for (const c of campos) {
        if (c.tipo === "number") datos[c.nombre] = Number(datos[c.nombre]) || 0;
        if (typeof datos[c.nombre] === "string") datos[c.nombre] = datos[c.nombre].trim();
      }
      terminar(datos);
    });
    dlg.oncancel = () => resolver(null); // tecla Esc
  });
}

function campoHtml(c) {
  if (c.tipo === "html") return `<div class="ancho nota">${c.html}</div>`; // texto informativo (ya escapado)
  const valor = seguro(c.valor ?? "");
  const req = c.requerido ? "required" : "";
  let control;
  if (c.tipo === "select") {
    control = `<select name="${c.nombre}" ${req}>${c.opciones.map((o) =>
      `<option value="${seguro(o.valor)}" ${String(o.valor) === String(c.valor ?? "") ? "selected" : ""}>${seguro(o.texto)}</option>`).join("")}</select>`;
  } else if (c.tipo === "textarea") {
    control = `<textarea name="${c.nombre}" rows="3" placeholder="${seguro(c.ayuda || "")}">${valor}</textarea>`;
  } else {
    const numero = c.tipo === "number" ? 'min="0" step="any" inputmode="decimal"' : "";
    const lista = c.sugerencias ? `list="dl-${c.nombre}"` : "";
    control = `<input name="${c.nombre}" type="${c.tipo || "text"}" value="${valor}" ${req} ${numero} ${lista} placeholder="${seguro(c.ayuda || "")}">`;
    if (c.sugerencias) control += `<datalist id="dl-${c.nombre}">${c.sugerencias.map((s) => `<option value="${seguro(s)}">`).join("")}</datalist>`;
  }
  return `<label class="${c.ancho ? "ancho" : ""}">${seguro(c.etiqueta)}${control}</label>`;
}

// Ventana sólo para mostrar información.
export function mostrar(titulo, html) {
  const dlg = $("#dialogo");
  dlg.innerHTML = `<form method="dialog"><h2>${seguro(titulo)}</h2>${html}<div class="fila fin"><button class="principal">Cerrar</button></div></form>`;
  dlg.showModal();
}

// Descarga un archivo generado por la app (CSV, respaldo, lista compartida).
export function descargar(nombreArchivo, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.replace(/[\\/:*?"<>|]/g, "-");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Barra de presupuesto que además EXPLICA cómo vas:
//   menos de 85 % → "Vas bien" (verde) · 85 a 100 % → "Cuidado" (naranja) · más → "Te pasaste" (rojo)
export function estadoPresupuesto(gastado, presupuesto) {
  const pct = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0;
  const queda = presupuesto - gastado;
  const estado = pct > 100 ? "pasado" : pct >= 85 ? "cuidado" : "bien";
  const mensaje = estado === "pasado" ? `${icono("alerta")} Te pasaste por ${dinero(-queda)}`
    : estado === "cuidado" ? `${icono("alerta")} Cuidado: te quedan ${dinero(queda)}`
    : `${icono("check")} Vas bien: te quedan ${dinero(queda)}`;
  return `
    <div class="presupuesto ${estado}">
      <div class="barra-progreso"><div style="width:${Math.min(100, pct)}%"></div></div>
      <div class="fila entre"><span>${dinero(gastado)} gastado (${Math.round(pct)} %)</span><strong>${mensaje}</strong></div>
    </div>`;
}

// Barras horizontales sencillas para los reportes.
export function barras(entradas, { ordenar = true } = {}) {
  const filas = ordenar ? [...entradas].sort((a, b) => b[1] - a[1]) : entradas;
  if (!filas.length) return `<p class="nota">Sin datos todavía.</p>`;
  const max = Math.max(...filas.map((f) => f[1]), 1);
  return filas.map(([etiqueta, monto]) => `
    <div class="barra-fila">
      <span>${seguro(etiqueta)}</span>
      <div class="barra-grafica"><div style="width:${(monto / max) * 100}%"></div></div>
      <strong>${dinero(monto)}</strong>
    </div>`).join("");
}
