// =====================================================================
// fotos.js — Guardar fotos de la bitácora en el celular.
//
// localStorage sólo aguanta unos 5 MB, así que las fotos van en IndexedDB,
// otra "bodega" del navegador mucho más grande y hecha para archivos.
// Antes de guardar, cada foto se achica (máx. 1280 px) y se comprime a JPG:
// de ~3 MB que pesa una foto del celular queda en ~150-250 KB.
// =====================================================================
import { nuevoId } from "./datos.js";

const BASE = "obralist-fotos";
const ALMACEN = "fotos";
let conexion = null;

function abrir() {
  if (!conexion) {
    conexion = new Promise((ok, mal) => {
      const r = indexedDB.open(BASE, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  }
  return conexion;
}

// Ejecuta una operación en el almacén y espera a que termine.
async function operacion(modo, fn) {
  const base = await abrir();
  return new Promise((ok, mal) => {
    const t = base.transaction(ALMACEN, modo);
    const pedido = fn(t.objectStore(ALMACEN));
    t.oncomplete = () => ok(pedido?.result);
    t.onerror = () => mal(t.error);
  });
}

// Achica y comprime una foto (File de la cámara o galería) → Blob JPG.
export async function comprimir(archivo, lado = 1280, calidad = 0.72) {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close?.();
  return new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
}

export async function guardarFoto(blob) {
  const id = nuevoId();
  await operacion("readwrite", (s) => s.put(blob, id));
  // Pide al navegador que no borre estos datos si falta espacio.
  navigator.storage?.persist?.().catch(() => {});
  return id;
}

export const leerFoto = (id) => operacion("readonly", (s) => s.get(id));

export async function borrarFoto(id) {
  await operacion("readwrite", (s) => s.delete(id));
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
}

// Dirección temporal para mostrar la foto en un <img>.
const urls = new Map();
export async function urlFoto(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await leerFoto(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}
