// =====================================================================
// guia.js — Guía de bienvenida: 4 pantallas cortas que explican la app.
// Sale sola la primera vez (si todavía no hay listas) y se puede volver
// a ver desde Más > Ayuda y soporte.
// =====================================================================
import { db, guardar } from "./datos.js";
import { icono } from "./iconos.js";

const PASOS = [
  {
    ico: "casco", titulo: "Bienvenido a ObraList",
    texto: "Organiza lo que compras, vendes y gastas, y sabe en todo momento cómo va tu plata. Sirve para proyectos y para cualquier negocio.",
  },
  {
    ico: "listas", titulo: "1. Haz tus listas",
    texto: "Una lista para cada proyecto, pedido o compra. Agrega lo que ocupas escribiendo o eligiéndolo de tu catálogo.",
  },
  {
    ico: "carrito", titulo: "2. Marca lo que compras",
    texto: "Al comprar, marca cada cosa. Al final registra la compra con el precio y el lugar: se guarda en Cuentas y el catálogo recuerda el último precio.",
  },
  {
    ico: "gastos", titulo: "3. Revisa tus cuentas",
    texto: "En Cuentas registras también tus ventas y gastos, y ves lo que entra, lo que sale y la ganancia, con gráficos que lo explican.",
  },
  {
    ico: "nube", titulo: "4. Guarda y comparte",
    texto: "En Más crea tu cuenta para guardar todo en la nube y compartir listas en vivo con tu equipo.",
  },
];

export function mostrarGuia() {
  const dlg = document.querySelector("#dialogo");
  let paso = 0;

  // Se marca como vista apenas se abre: así no vuelve a salir aunque la cierren a medias.
  if (!db.perfil.guiaVista) { db.perfil.guiaVista = true; guardar(); }

  const pintar = () => {
    const p = PASOS[paso];
    const ultimo = paso === PASOS.length - 1;
    dlg.innerHTML = `
      <div class="guia">
        <div class="guia-icono">${icono(p.ico, "icono-grande")}</div>
        <h2>${p.titulo}</h2>
        <p>${p.texto}</p>
        <div class="guia-puntos" aria-hidden="true">
          ${PASOS.map((_, i) => `<span class="${i === paso ? "activo" : ""}"></span>`).join("")}
        </div>
        <div class="fila entre">
          ${paso === 0
            ? `<button type="button" data-guia="cerrar">Saltar</button>`
            : `<button type="button" data-guia="atras">${icono("volver")}Atrás</button>`}
          <button type="button" class="principal" data-guia="${ultimo ? "cerrar" : "siguiente"}">
            ${ultimo ? "Empezar" : `Siguiente${icono("adelante")}`}
          </button>
        </div>
      </div>`;
  };

  // Un solo escuchador para los botones de la guía; se quita al cerrar.
  const alTocar = (e) => {
    const b = e.target.closest("[data-guia]");
    if (!b) return;
    if (b.dataset.guia === "siguiente") paso++;
    else if (b.dataset.guia === "atras") paso--;
    else { dlg.close(); dlg.removeEventListener("click", alTocar); return; }
    pintar();
  };
  dlg.addEventListener("click", alTocar);
  dlg.addEventListener("cancel", () => dlg.removeEventListener("click", alTocar), { once: true }); // tecla Esc / atrás

  pintar();
  dlg.showModal();
}

// Al abrir la app: sólo para quien empieza de cero.
export function guiaSiEsNueva() {
  if (!db.perfil.guiaVista && !db.listas.length) mostrarGuia();
}
