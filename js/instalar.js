// =====================================================================
// instalar.js — Todo lo de "instalar en el celular" (PWA) en un lugar.
//
// Cómo funciona la instalación:
//  • Android/Chrome avisa con el evento "beforeinstallprompt" cuando la app
//    SE PUEDE instalar. Si ya está instalada, o si rechazaste el aviso hace
//    poco, Chrome NO lo manda, y por eso el botón "desaparece".
//  • iPhone (Safari) nunca avisa: se instala a mano con Compartir → Agregar a inicio.
// Por eso, además del botón, mostramos instrucciones según el teléfono.
// =====================================================================
import { refrescar } from "./ui.js";

let avisoInstalar = null; // el evento que nos da Chrome para mostrar su ventana de instalar

const ua = navigator.userAgent;
export const plataforma =
  /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? "ios"
  : /android/i.test(ua) ? "android"
  : "escritorio";

// ¿Estamos dentro de la app instalada (sin barra del navegador)?
export const enAppInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export const sePuedeInstalar = () => avisoInstalar !== null;

export async function instalar() {
  if (!avisoInstalar) return false;
  avisoInstalar.prompt();
  const { outcome } = await avisoInstalar.userChoice;
  avisoInstalar = null;
  actualizarBotonBarra();
  refrescar();
  return outcome === "accepted";
}

function actualizarBotonBarra() {
  document.querySelector("#btnInstalar").hidden = !sePuedeInstalar();
}

export function iniciarInstalacion() {
  // Service worker: necesario para instalar y para que funcione sin internet.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW no registrado", e));
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // guardamos el aviso para lanzarlo desde nuestro botón
    avisoInstalar = e;
    actualizarBotonBarra();
    refrescar();
  });

  window.addEventListener("appinstalled", () => {
    avisoInstalar = null;
    actualizarBotonBarra();
    refrescar();
  });

  document.querySelector("#btnInstalar").addEventListener("click", instalar);

  if (plataforma === "ios" && !enAppInstalada()) document.querySelector("#ayudaIos").hidden = false;
}
