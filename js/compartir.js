// =====================================================================
// compartir.js — Listas compartidas en tiempo real.
//
// • Las listas que OTROS me comparten se guardan en db.listas con la marca
//   `_compartida: { dueno, email }`. No se suben como mías: se sincronizan
//   aparte, contra la fila del dueño en la nube.
// • Las listas MÍAS que comparto siguen siendo mías; sólo se guarda a
//   quién se las compartí (tabla "compartidos" en Supabase).
// Igual que nube.js, se usan "huellas" para saber qué cambió de cada lado.
// =====================================================================
import { db, buscar, categoria, unidad } from "./datos.js";

const CLAVE = "obralist-compartidas";

// Estado visible para las pantallas
export const compartir = {
  disponible: true,   // false si falta correr compartir.sql en Supabase
  mias: {},           // listaId → [correos invitados]
};

export const esCompartidaConmigo = (l) => Boolean(l?._compartida);
const sinMarca = ({ _compartida, ...resto }) => resto;

// Guarda en cada material el nombre de su categoría y unidad. Así, si la lista
// la abre otra persona (que tiene sus propias categorías), igual se entiende.
export function anotarNombres(lista) {
  for (const it of lista.items || []) {
    const c = buscar("categorias", it.categoriaId);
    if (c && it.categoriaNombre !== c.nombre) it.categoriaNombre = c.nombre;
    const u = buscar("unidades", it.unidadId);
    if (u && it.unidadAbrev !== u.abrev) it.unidadAbrev = u.abrev;
  }
  return lista;
}

// Categoría y unidad de un material, aunque venga de la lista de otra persona.
export function categoriaDeItem(it) {
  return buscar("categorias", it.categoriaId)
    || db.categorias.find((c) => c.nombre === it.categoriaNombre)
    || { id: `nombre:${it.categoriaNombre || "Sin categoría"}`, icono: "etiqueta", nombre: it.categoriaNombre || categoria(it.categoriaId).nombre };
}
export function unidadDeItem(it) {
  return buscar("unidades", it.unidadId) || { abrev: it.unidadAbrev || unidad(it.unidadId).abrev, nombre: it.unidadAbrev || "" };
}

function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || { huellas: {} }; } catch { return { huellas: {} }; }
}
function escribir(e) { try { localStorage.setItem(CLAVE, JSON.stringify(e)); } catch {} }
export const olvidarCompartidas = () => { localStorage.removeItem(CLAVE); compartir.mias = {}; };

const faltaTabla = (error) => /compartidos|PGRST205|42P01|does not exist/i.test(String(error?.message || error?.code || ""));

// Se llama en cada sincronización. Devuelve cuántos cambios aplicó aquí.
export async function sincronizarCompartidas(cliente, usuario, huella) {
  const yo = (usuario.email || "").toLowerCase();
  const { data: invitaciones, error } = await cliente.from("compartidos").select("dueno,dueno_email,lista_id,invitado_email");
  if (error) {
    if (faltaTabla(error)) { compartir.disponible = false; return 0; }
    throw error;
  }
  compartir.disponible = true;

  // Las que yo comparto (para mostrar "Compartida con …")
  compartir.mias = {};
  for (const c of invitaciones.filter((x) => x.dueno === usuario.id)) (compartir.mias[c.lista_id] ||= []).push(c.invitado_email);

  // Las que me comparten
  const conmigo = invitaciones.filter((x) => x.invitado_email === yo && x.dueno !== usuario.id);
  const estado = leer();
  if (estado.usuario !== usuario.id) { estado.usuario = usuario.id; estado.huellas = {}; }
  let cambios = 0;
  const vigentes = new Set();

  for (const inv of conmigo) {
    const { data: filas, error: e2 } = await cliente.from("registros")
      .select("usuario,id,datos,borrado").eq("usuario", inv.dueno).eq("coleccion", "listas").eq("id", inv.lista_id);
    if (e2) throw e2;
    const fila = filas[0];
    if (!fila || fila.borrado || !fila.datos) continue; // el dueño la borró
    vigentes.add(fila.id);

    const local = db.listas.find((l) => l.id === fila.id && l._compartida);
    if (local) anotarNombres(local);
    const hLocal = local ? huella(sinMarca(local)) : null;
    const hGuardada = estado.huellas[fila.id] ?? null;

    if (local && hLocal !== hGuardada) {
      // La cambié aquí: se la subo al dueño (gana lo de este dispositivo)
      const { error: e3 } = await cliente.from("registros")
        .update({ datos: sinMarca(local) }).eq("usuario", inv.dueno).eq("coleccion", "listas").eq("id", fila.id);
      if (e3) throw e3;
      estado.huellas[fila.id] = hLocal;
      continue;
    }
    const hNube = huella(fila.datos);
    if (hNube !== hLocal) {
      const marca = { _compartida: { dueno: inv.dueno, email: inv.dueno_email } };
      if (local) {
        for (const k of Object.keys(local)) delete local[k];
        Object.assign(local, fila.datos, marca); // en el mismo objeto: las pantallas abiertas lo siguen viendo
      } else {
        db.listas.push({ ...fila.datos, ...marca });
      }
      cambios++;
    }
    estado.huellas[fila.id] = hNube;
  }

  // Ya no me la comparten (o el dueño la borró): se quita de aquí
  for (const l of [...db.listas]) {
    if (l._compartida && !vigentes.has(l.id)) {
      db.listas.splice(db.listas.indexOf(l), 1);
      delete estado.huellas[l.id];
      cambios++;
    }
  }
  escribir(estado);
  return cambios;
}

// ---------- Acciones del dueño y del invitado ----------
export async function invitar(cliente, listaId, correo) {
  const { error } = await cliente.from("compartidos").insert({ lista_id: listaId, invitado_email: correo.trim().toLowerCase() });
  if (error) {
    if (/duplicate|23505/i.test(error.message + error.code)) throw new Error("Esa persona ya tiene acceso a la lista.");
    if (faltaTabla(error)) throw new Error("Falta activar las listas compartidas en Supabase (archivo compartir.sql).");
    if (/row-level security|42501/i.test(error.message + error.code)) throw new Error("No se pudo compartir: espera a que la lista se sincronice y vuelve a intentar.");
    throw error;
  }
}

export async function quitarInvitado(cliente, usuarioId, listaId, correo) {
  const { error } = await cliente.from("compartidos").delete().eq("dueno", usuarioId).eq("lista_id", listaId).eq("invitado_email", correo);
  if (error) throw error;
}

export async function salirDeLista(cliente, lista, miCorreo) {
  const { error } = await cliente.from("compartidos").delete()
    .eq("dueno", lista._compartida.dueno).eq("lista_id", lista.id).eq("invitado_email", miCorreo.toLowerCase());
  if (error) throw error;
}

// ---------- Tiempo real: avisar cuando algo cambia en la nube ----------
let canal = null;
export function escucharCambios(cliente, alCambiar) {
  if (canal) return;
  canal = cliente.channel("obralist-cambios")
    .on("postgres_changes", { event: "*", schema: "public", table: "registros" }, alCambiar)
    .on("postgres_changes", { event: "*", schema: "public", table: "compartidos" }, alCambiar)
    .subscribe();
}
export function dejarDeEscuchar(cliente) {
  if (canal) { cliente.removeChannel(canal); canal = null; }
}
