// =====================================================================
// nube.js — Cuenta de usuario y sincronización con Supabase.
//
// IDEA: la app sigue trabajando 100 % en el celular (funciona sin señal).
// Cuando hay internet y sesión iniciada, "sincroniza":
//   1) BAJA lo que cambió en la nube desde la última vez (otro dispositivo).
//   2) SUBE lo que cambió en este dispositivo.
//
// ¿Cómo sabe qué cambió? Guarda una "huella" (un código corto calculado del
// contenido) de cada cosa tal como quedó en la última sincronización. Si la
// huella actual es distinta, esa cosa cambió aquí y hay que subirla.
// Si algo cambió en los dos lados a la vez, gana lo de este dispositivo.
//
// Las fotos de la bitácora todavía NO se suben (siguiente etapa).
// =====================================================================
import { db, guardar, alGuardar, reemplazarTodo, vacio } from "./datos.js";
import { SUPABASE } from "./config.js";
import { aviso, formulario, aplicarApariencia, refrescarSiSePuede } from "./ui.js";

// Versión fija de la librería de Supabase (se descarga sólo si hay internet)
const URL_LIBRERIA = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
const CLAVE_ESTADO = "obralist-sync";
const COLECCIONES = ["categorias", "unidades", "productos", "proveedores", "listas", "compras", "gastos", "bitacora"];
const LOTE = 500; // cuántas filas se suben por envío

// Estado visible para la pantalla "Más"
export const nube = {
  configurada: Boolean(SUPABASE.url && SUPABASE.clave),
  lista: false,          // ya se cargó la librería y se revisó la sesión
  usuario: null,         // { id, email } cuando hay sesión
  sincronizando: false,
  ultima: null,          // Date de la última sincronización exitosa
  error: "",
};

let cliente = null;
let temporizador = null;
let aplicando = false;   // true mientras guardamos cambios que vinieron de la nube
let otraVez = false;     // llegó un pedido de sincronizar mientras ya sincronizaba

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------
export async function iniciarNube() {
  // Cada vez que la app guarda algo, programamos una sincronización.
  alGuardar(() => { if (!aplicando && nube.usuario) programar(3000); });
  window.addEventListener("online", () => programar(1000));
  if (!nube.configurada) return;
  try {
    await obtenerCliente();
    const { data } = await cliente.auth.getSession();
    nube.usuario = data.session?.user || null;
    nube.ultima = leerEstado().fecha ? new Date(leerEstado().fecha) : null;
    if (nube.usuario) programar(300);
  } catch (e) {
    nube.error = navigator.onLine ? "No se pudo conectar con la nube." : "Sin internet: tus datos se guardan en el celular.";
  } finally {
    nube.lista = true;
    refrescarSiSePuede();
  }
}

async function obtenerCliente() {
  if (cliente) return cliente;
  const { createClient } = await import(URL_LIBRERIA);
  cliente = createClient(SUPABASE.url, SUPABASE.clave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  cliente.auth.onAuthStateChange((evento, sesion) => {
    nube.usuario = sesion?.user || null;
    // No llamar a Supabase directo aquí adentro: se usa setTimeout.
    if (evento === "PASSWORD_RECOVERY") setTimeout(pedirNuevaContrasena, 0);
    if (evento === "SIGNED_IN") { limpiarDireccion(); programar(0); }
    refrescarSiSePuede();
  });
  return cliente;
}

// Al confirmar el correo, Supabase vuelve a la app con datos en la dirección (#access_token=…).
function limpiarDireccion() {
  if (/access_token|error_description|type=/.test(location.hash)) {
    history.replaceState(null, "", `${location.pathname}${location.search}#/mas`);
  }
}

// ---------------------------------------------------------------------
// Cuenta: entrar, crear, recuperar, salir
// ---------------------------------------------------------------------
export async function entrar(correo, contrasena) {
  await obtenerCliente();
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) throw new Error(traducir(error));
}

export async function crearCuenta(correo, contrasena) {
  await obtenerCliente();
  const { data, error } = await cliente.auth.signUp({
    email: correo, password: contrasena,
    options: { emailRedirectTo: direccionApp() },
  });
  if (error) throw new Error(traducir(error));
  return { requiereConfirmar: !data.session };
}

export async function recuperarContrasena(correo) {
  await obtenerCliente();
  const { error } = await cliente.auth.resetPasswordForEmail(correo, { redirectTo: direccionApp() });
  if (error) throw new Error(traducir(error));
}

async function pedirNuevaContrasena() {
  const d = await formulario({
    titulo: "Nueva contraseña", boton: "Guardar contraseña",
    campos: [{ nombre: "contrasena", etiqueta: "Escribe tu nueva contraseña (mínimo 6 caracteres)", tipo: "password", requerido: true, ancho: true }],
  });
  if (!d) return;
  const { error } = await cliente.auth.updateUser({ password: d.contrasena });
  aviso(error ? traducir(error) : "Contraseña actualizada");
}

export async function salir() {
  await cliente?.auth.signOut();
  localStorage.removeItem(CLAVE_ESTADO);
  nube.usuario = null;
  nube.ultima = null;
  refrescarSiSePuede();
  aviso("Sesión cerrada. Tus datos siguen en este dispositivo.");
}

const direccionApp = () => `${location.origin}${location.pathname}`;

function traducir(error) {
  const m = String(error?.message || error || "");
  if (/Invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(m)) return "Primero confirma tu correo: revisa tu bandeja de entrada.";
  if (/already registered|already been registered/i.test(m)) return "Ya existe una cuenta con ese correo. Toca Entrar.";
  if (/at least 6|Password should be/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
  if (/rate limit|too many/i.test(m)) return "Demasiados intentos. Espera unos minutos.";
  if (/invalid.*email|Unable to validate email/i.test(m)) return "Ese correo no es válido.";
  if (/registros|PGRST205|42P01|does not exist/i.test(m)) return "Falta crear la tabla en Supabase (paso del archivo esquema.sql).";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sin conexión con la nube.";
  return m || "Ocurrió un error con la nube.";
}

// ---------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------
export function programar(espera = 3000) {
  clearTimeout(temporizador);
  temporizador = setTimeout(() => sincronizar().catch(() => {}), espera);
}

export async function sincronizar({ manual = false } = {}) {
  if (!nube.usuario || !cliente) return;
  if (!navigator.onLine) { if (manual) aviso("Sin internet. Se sincroniza cuando vuelva la señal."); return; }
  if (nube.sincronizando) { otraVez = true; return; }
  nube.sincronizando = true;
  nube.error = "";
  refrescarSiSePuede();
  try {
    let estado = leerEstado();
    if (estado.usuario !== nube.usuario.id) estado = await primeraVez(nube.usuario.id);
    const bajados = await bajarCambios(estado);
    await subirCambios(estado);
    estado.fecha = new Date().toISOString();
    guardarEstado(estado);
    nube.ultima = new Date(estado.fecha);
    if (manual) aviso("Sincronizado");
    if (bajados) aplicarApariencia();
  } catch (e) {
    if (e.message !== "cancelado") {
      nube.error = traducir(e);
      if (manual) aviso(nube.error);
      console.warn("Sincronización", e);
    }
  } finally {
    nube.sincronizando = false;
    refrescarSiSePuede();
    if (otraVez) { otraVez = false; programar(500); }
  }
}

// 1) Bajar de la nube lo que cambió desde la última vez y aplicarlo aquí.
async function bajarCambios(estado) {
  const filas = await traerFilas(estado.ultimaFila);
  const actuales = cosasLocales();
  let aplicadas = 0;
  for (const f of filas) {
    const clave = `${f.coleccion}:${f.id}`;
    const local = actuales.get(clave);
    const huellaLocal = local ? huella(local.datos) : null;
    const cambioAqui = huellaLocal !== (estado.huellas[clave] ?? null);
    if (cambioAqui) continue; // gana lo de este dispositivo (se sube en el paso 2)
    const huellaNube = f.borrado ? null : huella(f.datos);
    if (huellaNube !== huellaLocal) { aplicarFila(f); aplicadas++; }
    if (f.borrado) delete estado.huellas[clave];
    else estado.huellas[clave] = huellaNube;
  }
  if (filas.length) estado.ultimaFila = filas[filas.length - 1].actualizado;
  if (aplicadas) {
    aplicando = true;
    try { guardar(); } finally { aplicando = false; } // guarda en el celular
  }
  return aplicadas;
}

// 2) Subir lo que cambió en este dispositivo (y avisar lo que se borró).
async function subirCambios(estado) {
  const actuales = cosasLocales();
  const filas = [];
  const nuevas = {};
  for (const [clave, cosa] of actuales) {
    const h = huella(cosa.datos);
    if (estado.huellas[clave] !== h) {
      filas.push({ usuario: nube.usuario.id, coleccion: cosa.coleccion, id: cosa.id, datos: cosa.datos, borrado: false });
      nuevas[clave] = h;
    }
  }
  for (const clave of Object.keys(estado.huellas)) {
    if (!actuales.has(clave)) {
      const [coleccion, ...resto] = clave.split(":");
      filas.push({ usuario: nube.usuario.id, coleccion, id: resto.join(":"), datos: null, borrado: true });
      nuevas[clave] = null;
    }
  }
  for (let i = 0; i < filas.length; i += LOTE) {
    const { error } = await cliente.from("registros").upsert(filas.slice(i, i + LOTE), { onConflict: "usuario,coleccion,id" });
    if (error) throw error;
  }
  for (const [clave, h] of Object.entries(nuevas)) {
    if (h === null) delete estado.huellas[clave];
    else estado.huellas[clave] = h;
  }
  return filas.length;
}

// Primera vez que esta cuenta se usa en este dispositivo.
async function primeraVez(usuarioId) {
  const filas = await traerFilas(null);
  const vivas = filas.filter((f) => !f.borrado);
  const estado = { usuario: usuarioId, ultimaFila: filas.length ? filas[filas.length - 1].actualizado : null, huellas: {}, fecha: null };
  if (!vivas.length) return estado; // cuenta nueva: se sube todo lo de este dispositivo

  const deLaNube = armarDesdeFilas(vivas);
  const tengoDatosPropios = ["listas", "compras", "gastos", "bitacora", "proveedores"].some((c) => db[c].length);
  let resultado = deLaNube;
  if (tengoDatosPropios) {
    const d = await formulario({
      titulo: "Ya tienes datos en tu cuenta",
      boton: "Continuar",
      campos: [{
        nombre: "modo", etiqueta: "¿Qué hago con lo que hay en este dispositivo?", tipo: "select", ancho: true, valor: "combinar",
        opciones: [
          { valor: "combinar", texto: "Combinar: sumar lo de este dispositivo a mi cuenta" },
          { valor: "cuenta", texto: "Usar sólo lo de la cuenta (reemplaza este dispositivo)" },
        ],
      }],
    });
    if (!d) throw new Error("cancelado");
    if (d.modo === "combinar") resultado = combinar(deLaNube, JSON.parse(JSON.stringify(db)));
  }
  for (const f of vivas) estado.huellas[`${f.coleccion}:${f.id}`] = huella(f.datos);
  aplicando = true;
  try { reemplazarTodo(resultado); } finally { aplicando = false; }
  aplicarApariencia();
  return estado;
}

// Une los datos de la nube (R) con los de este dispositivo (L) sin duplicar
// categorías, unidades, productos ni proveedores que tengan el mismo nombre.
function combinar(R, L) {
  const igualA = (lista, campo, valor) => lista.find((x) => String(x[campo]).toLowerCase() === String(valor).toLowerCase());
  const mapa = { categorias: {}, unidades: {}, productos: {}, proveedores: {} };
  const enlazar = (col, campo, preparar = (x) => x) => {
    for (const x of L[col]) {
      const igual = R[col].find((y) => y.id === x.id) || igualA(R[col], campo, x[campo]);
      if (igual) mapa[col][x.id] = igual.id;
      else { R[col].push(preparar(x)); mapa[col][x.id] = x.id; }
    }
  };
  const nuevoId = (col, id) => (id ? mapa[col][id] ?? id : id);
  enlazar("categorias", "nombre");
  enlazar("unidades", "abrev");
  enlazar("proveedores", "nombre");
  enlazar("productos", "nombre", (p) => ({ ...p, categoriaId: nuevoId("categorias", p.categoriaId), unidadId: nuevoId("unidades", p.unidadId) }));
  const item = (i) => ({ ...i, categoriaId: nuevoId("categorias", i.categoriaId), unidadId: nuevoId("unidades", i.unidadId), productoId: nuevoId("productos", i.productoId) });
  const falta = (col, x) => !R[col].some((y) => y.id === x.id);
  for (const l of L.listas) if (falta("listas", l)) R.listas.push({ ...l, items: l.items.map(item) });
  for (const c of L.compras) if (falta("compras", c)) R.compras.push({ ...c, proveedorId: nuevoId("proveedores", c.proveedorId), items: c.items.map(item) });
  for (const g of L.gastos) if (falta("gastos", g)) R.gastos.push(g);
  for (const b of L.bitacora) if (falta("bitacora", b)) R.bitacora.push(b);
  for (const campo of ["nombre", "ocupacion"]) if (!R.perfil[campo] && L.perfil[campo]) R.perfil[campo] = L.perfil[campo];
  return R;
}

// ---------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------
// Todo lo que hay en el celular, como "coleccion:id" → { coleccion, id, datos }
function cosasLocales() {
  const m = new Map();
  for (const col of COLECCIONES) for (const x of db[col] || []) m.set(`${col}:${x.id}`, { coleccion: col, id: x.id, datos: x });
  m.set("perfil:perfil", { coleccion: "perfil", id: "perfil", datos: db.perfil });
  return m;
}

// Trae filas de la nube (de 1000 en 1000), opcionalmente sólo las cambiadas después de "desde".
async function traerFilas(desde) {
  const filas = [];
  for (let inicio = 0; ; inicio += 1000) {
    let consulta = cliente.from("registros")
      .select("coleccion,id,datos,borrado,actualizado")
      .eq("usuario", nube.usuario.id)
      .order("actualizado", { ascending: true })
      .range(inicio, inicio + 999);
    if (desde) consulta = consulta.gt("actualizado", desde);
    const { data, error } = await consulta;
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

function armarDesdeFilas(filas) {
  const d = { ...vacio(), version: 4, perfil: { ...db.perfil } };
  for (const col of COLECCIONES) d[col] = [];
  for (const f of filas) {
    if (f.coleccion === "perfil") Object.assign(d.perfil, f.datos);
    else if (d[f.coleccion]) d[f.coleccion].push(f.datos);
  }
  return d;
}

// Aplica una fila de la nube al objeto local, modificándolo "en el lugar"
// (así las pantallas abiertas siguen apuntando al mismo objeto).
function aplicarFila(f) {
  if (f.coleccion === "perfil") { if (!f.borrado) Object.assign(db.perfil, f.datos); return; }
  const lista = db[f.coleccion];
  if (!Array.isArray(lista)) return;
  const i = lista.findIndex((x) => x.id === f.id);
  if (f.borrado) { if (i >= 0) lista.splice(i, 1); return; }
  if (i < 0) { lista.push(f.datos); return; }
  for (const k of Object.keys(lista[i])) delete lista[i][k];
  Object.assign(lista[i], f.datos);
}

// Huella: un código corto que cambia si cambia cualquier dato del objeto.
// Ordena las llaves primero, porque la nube puede devolverlas en otro orden.
function ordenado(v) {
  if (Array.isArray(v)) return v.map(ordenado);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenado(v[k])]));
  return v;
}
export function huella(obj) {
  const s = JSON.stringify(ordenado(obj ?? null));
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function leerEstado() {
  try { return JSON.parse(localStorage.getItem(CLAVE_ESTADO)) || { huellas: {} }; }
  catch { return { huellas: {} }; }
}
function guardarEstado(estado) {
  try { localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado)); } catch {}
}

// Sólo para pruebas: usar un servidor simulado en vez de Supabase.
export function _usarClientePrueba(clientePrueba, usuario) {
  cliente = clientePrueba;
  nube.configurada = true;
  nube.lista = true;
  nube.usuario = usuario;
}
