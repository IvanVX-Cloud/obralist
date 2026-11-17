// =====================================================================
// tipocambio.js — Tipo de cambio del dólar, actualizado solo cada día.
//
// Fuente principal: Ministerio de Hacienda de Costa Rica, que publica el
// tipo de cambio de referencia del Banco Central (BCCR). Es gratis y no
// necesita clave. Si falla, se usa ExchangeRate-API (también gratis).
// Sin internet se usa el último que se guardó.
// =====================================================================
import { db, guardar } from "./datos.js";
import { refrescarSiSePuede } from "./ui.js";

const FUENTES = [
  {
    nombre: "BCCR (Hacienda)",
    url: "https://api.hacienda.go.cr/indicadores/tc/dolar",
    leer: (d) => ({ venta: d?.venta?.valor, compra: d?.compra?.valor, fecha: d?.venta?.fecha }),
  },
  {
    nombre: "ExchangeRate-API",
    url: "https://open.er-api.com/v6/latest/USD",
    leer: (d) => ({ venta: d?.rates?.CRC, compra: null, fecha: d?.time_last_update_unix ? new Date(d.time_last_update_unix * 1000).toISOString().slice(0, 10) : null }),
  },
];

const CADA = 6 * 60 * 60 * 1000; // volver a consultar cada 6 horas
let consultando = false;

async function conTiempoLimite(url, ms = 8000) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ms);
  try {
    const r = await fetch(url, { signal: control.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// Consulta el tipo de cambio si hace falta (o siempre si forzar = true).
// Devuelve true si se actualizó.
export async function actualizarTipoCambio({ forzar = false } = {}) {
  const ultimo = db.perfil.tcAuto;
  const reciente = ultimo?.consultado && Date.now() - new Date(ultimo.consultado).getTime() < CADA;
  if (consultando || !navigator.onLine || (reciente && !forzar)) return false;
  consultando = true;
  try {
    for (const f of FUENTES) {
      try {
        const { venta, compra, fecha } = f.leer(await conTiempoLimite(f.url));
        if (Number(venta) > 100 && Number(venta) < 2000) { // descarta respuestas absurdas
          db.perfil.tcAuto = {
            venta: Math.round(Number(venta) * 100) / 100,
            compra: Number(compra) > 0 ? Math.round(Number(compra) * 100) / 100 : null,
            fecha: fecha || new Date().toISOString().slice(0, 10),
            fuente: f.nombre,
            consultado: new Date().toISOString(),
          };
          guardar();
          refrescarSiSePuede();
          return true;
        }
      } catch (e) {
        console.warn(`Tipo de cambio: falló ${f.nombre}`, e);
      }
    }
    return false;
  } finally {
    consultando = false;
  }
}

export function iniciarTipoCambio() {
  actualizarTipoCambio();
  window.addEventListener("online", () => actualizarTipoCambio());
}
