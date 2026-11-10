// =====================================================================
// Calculadoras de obra: calculan cuánto material necesitas y lo agregan
// a una lista con un toque.
//
// Cada calculadora es un objeto con:
//   campos      → lo que el usuario llena (medidas, tipo…)
//   calcular(v) → recibe los valores y devuelve { resumen, materiales, nota }
// Para agregar una calculadora nueva, sólo agrega otro objeto a CALCULADORAS.
//
// ⚠️ Los rendimientos son APROXIMADOS (valores típicos de obra). Ajústalos
// a tu experiencia cambiando los números de este archivo.
// =====================================================================
import { db, guardar, buscar, nuevoId, hoy, agregarALista } from "../datos.js";
import { seguro, formulario, aviso, refrescar, ir } from "../ui.js";

const DESPERDICIO = 1.05; // +5 %

// Redondear hacia arriba a pasos (ej. 0.5 m³)
const arriba = (n, paso = 1) => Math.ceil(n / paso - 1e-9) * paso;
const num = (n, dec = 2) => (Math.round(n * 10 ** dec) / 10 ** dec).toLocaleString("es-CR");

// Concreto por m³ según resistencia (sacos de 50 kg, arena y piedra en m³)
const MEZCLAS = {
  175: { sacos: 6, arena: 0.5, piedra: 0.8 },
  210: { sacos: 7, arena: 0.45, piedra: 0.75 },
  245: { sacos: 8, arena: 0.42, piedra: 0.7 },
};

// Cable de cobre THHN: [calibre, amperios que aguanta, ohmios por km]
const CABLES = [[14, 15, 8.28], [12, 20, 5.21], [10, 30, 3.28], [8, 40, 2.06], [6, 55, 1.3], [4, 70, 0.82]];

export const CALCULADORAS = {
  concreto: {
    titulo: "Concreto", icono: "🏗️", descripcion: "Losas, contrapisos, aceras, vigas y columnas",
    oficios: ["Albañil", "Maestro de obras", "Contratista", "Ingeniero/a", "Arquitecto/a"],
    campos: [
      { nombre: "largo", etiqueta: "Largo (m)", tipo: "number", valor: 3 },
      { nombre: "ancho", etiqueta: "Ancho (m)", tipo: "number", valor: 3 },
      { nombre: "espesor", etiqueta: "Espesor (cm)", tipo: "number", valor: 10 },
      { nombre: "resistencia", etiqueta: "Resistencia", tipo: "select", valor: "210", opciones: [
        { valor: "175", texto: "175 kg/cm² · contrapisos y aceras" },
        { valor: "210", texto: "210 kg/cm² · losas, vigas, columnas" },
        { valor: "245", texto: "245 kg/cm² · estructural alta" },
      ] },
    ],
    calcular(v) {
      const m3 = v.largo * v.ancho * (v.espesor / 100);
      const t = MEZCLAS[v.resistencia] || MEZCLAS[210];
      return {
        resumen: `Volumen: ${num(m3)} m³`,
        materiales: [
          { nombre: "Cemento gris (saco 50 kg)", cantidad: arriba(m3 * t.sacos * DESPERDICIO), categoria: "Obra negra", unidad: "saco" },
          { nombre: "Arena", cantidad: arriba(m3 * t.arena * DESPERDICIO, 0.5), categoria: "Obra negra", unidad: "m³" },
          { nombre: "Piedra quintilla", cantidad: arriba(m3 * t.piedra * DESPERDICIO, 0.5), categoria: "Obra negra", unidad: "m³" },
        ],
        nota: "Incluye 5 % de desperdicio. No incluye la varilla ni la formaleta.",
      };
    },
  },

  block: {
    titulo: "Pared de block", icono: "🧱", descripcion: "Cuántos blocks y mortero para una pared",
    oficios: ["Albañil", "Maestro de obras", "Contratista"],
    campos: [
      { nombre: "largo", etiqueta: "Largo de la pared (m)", tipo: "number", valor: 5 },
      { nombre: "alto", etiqueta: "Alto (m)", tipo: "number", valor: 2.5 },
      { nombre: "huecos", etiqueta: "Puertas y ventanas (m²)", tipo: "number", valor: 0 },
      { nombre: "tipo", etiqueta: "Block", tipo: "select", valor: "15", opciones: [
        { valor: "15", texto: "15x20x40" }, { valor: "12", texto: "12x20x40" },
      ] },
    ],
    calcular(v) {
      const area = Math.max(0, v.largo * v.alto - v.huecos);
      return {
        resumen: `Área de pared: ${num(area)} m² (12,5 blocks por m²)`,
        materiales: [
          { nombre: `Block ${v.tipo}x20x40`, cantidad: arriba(area * 12.5 * DESPERDICIO), categoria: "Obra negra", unidad: "und" },
          { nombre: "Mortero para pegar block (saco 40 kg)", cantidad: arriba(area * (v.tipo === "15" ? 0.55 : 0.45)), categoria: "Obra negra", unidad: "saco" },
        ],
        nota: "Incluye 5 % de desperdicio en block. Para columnas y vigas usa la calculadora de concreto.",
      };
    },
  },

  repello: {
    titulo: "Repello", icono: "🪣", descripcion: "Sacos de repello para paredes",
    oficios: ["Albañil", "Maestro de obras", "Contratista"],
    campos: [
      { nombre: "area", etiqueta: "Área de pared (m²)", tipo: "number", valor: 12.5 },
      { nombre: "caras", etiqueta: "Caras", tipo: "select", valor: "1", opciones: [
        { valor: "1", texto: "Una cara" }, { valor: "2", texto: "Ambas caras" },
      ] },
      { nombre: "espesor", etiqueta: "Espesor (cm)", tipo: "number", valor: 1.5 },
    ],
    calcular(v) {
      const area = v.area * Number(v.caras);
      // Un saco de 40 kg rinde aprox. 0,022 m³ de mezcla
      const sacos = arriba(((area * v.espesor) / 100 / 0.022) * DESPERDICIO);
      return {
        resumen: `Área total: ${num(area)} m² a ${num(v.espesor, 1)} cm`,
        materiales: [{ nombre: "Repello fino (saco 40 kg)", cantidad: sacos, categoria: "Obra negra", unidad: "saco" }],
        nota: "Un saco de 40 kg rinde aprox. 1,4 m² a 1,5 cm. Incluye 5 % de desperdicio.",
      };
    },
  },

  pintura: {
    titulo: "Pintura", icono: "🎨", descripcion: "Galones y cubetas por área",
    oficios: ["Pintor", "Maestro de obras", "Contratista"],
    campos: [
      { nombre: "area", etiqueta: "Área a pintar (m²)", tipo: "number", valor: 60 },
      { nombre: "manos", etiqueta: "Manos", tipo: "number", valor: 2 },
      { nombre: "rendimiento", etiqueta: "Rendimiento (m² por galón)", tipo: "number", valor: 35 },
    ],
    calcular(v) {
      const galones = arriba((v.area * v.manos) / (v.rendimiento || 35));
      const cubetas = Math.floor(galones / 5);
      const sueltos = galones - cubetas * 5;
      return {
        resumen: `${galones} galones en total (${num(v.area)} m² × ${v.manos} manos)`,
        materiales: [
          { nombre: "Pintura látex (cubeta 5 gal)", cantidad: cubetas, categoria: "Acabados", unidad: "cubeta" },
          { nombre: "Pintura látex (galón)", cantidad: sueltos, categoria: "Acabados", unidad: "gal" },
        ],
        nota: "El rendimiento cambia según la marca y la superficie; revísalo en la etiqueta.",
      };
    },
  },

  piso: {
    titulo: "Piso cerámico", icono: "🔲", descripcion: "Cerámica, pegamento y fragua",
    oficios: ["Enchapador", "Albañil", "Maestro de obras", "Contratista"],
    campos: [
      { nombre: "largo", etiqueta: "Largo (m)", tipo: "number", valor: 4 },
      { nombre: "ancho", etiqueta: "Ancho (m)", tipo: "number", valor: 3 },
      { nombre: "desperdicio", etiqueta: "Desperdicio (%)", tipo: "number", valor: 10 },
    ],
    calcular(v) {
      const area = v.largo * v.ancho;
      return {
        resumen: `Área: ${num(area)} m²`,
        materiales: [
          { nombre: "Piso cerámico", cantidad: arriba(area * (1 + v.desperdicio / 100)), categoria: "Acabados", unidad: "m²" },
          { nombre: "Pegamento para cerámica (saco 20 kg)", cantidad: arriba((area * 4.5) / 20), categoria: "Acabados", unidad: "saco" },
          { nombre: "Fragua (bolsa 2 kg)", cantidad: Math.max(1, arriba((area * 0.3) / 2)), categoria: "Acabados", unidad: "und" },
        ],
        nota: "Pegamento aprox. 4,5 kg/m² y fragua 0,3 kg/m². Si el piso es diagonal, usa 15 % de desperdicio.",
      };
    },
  },

  cable: {
    titulo: "Calibre de cable", icono: "⚡", descripcion: "Qué cable usar según amperios y distancia",
    oficios: ["Electricista", "Ingeniero/a", "Contratista"],
    campos: [
      { nombre: "amperios", etiqueta: "Breaker / carga (A)", tipo: "select", valor: "20", opciones:
        [15, 20, 30, 40, 50, 60].map((a) => ({ valor: String(a), texto: `${a} A` })) },
      { nombre: "distancia", etiqueta: "Distancia del tablero (m)", tipo: "number", valor: 25 },
      { nombre: "voltaje", etiqueta: "Voltaje", tipo: "select", valor: "120", opciones: [
        { valor: "120", texto: "120 V" }, { valor: "240", texto: "240 V" },
      ] },
      { nombre: "hilos", etiqueta: "Cables por circuito", tipo: "select", valor: "3", opciones: [
        { valor: "2", texto: "2 (fase y neutro)" }, { valor: "3", texto: "3 (con tierra)" },
      ] },
    ],
    calcular(v) {
      const amp = Number(v.amperios), volt = Number(v.voltaje);
      // 1) el calibre más delgado que aguanta la corriente
      let i = CABLES.findIndex(([, a]) => a >= amp);
      if (i < 0) i = CABLES.length - 1;
      // 2) si la caída de tensión pasa de 3 %, subimos de calibre
      const caida = (idx) => ((2 * v.distancia * amp * CABLES[idx][2]) / 1000 / volt) * 100;
      const porCorriente = CABLES[i][0];
      while (caida(i) > 3 && i < CABLES.length - 1) i++;
      const [calibre] = CABLES[i];
      const metros = arriba(v.distancia * Number(v.hilos) * 1.1);
      const enRollo = [14, 12, 10].includes(calibre);
      return {
        resumen: `Cable THHN #${calibre} · caída de tensión ${num(caida(i), 1)} %${calibre !== porCorriente ? ` (por la distancia se sube de #${porCorriente} a #${calibre})` : ""}`,
        materiales: [
          enRollo
            ? { nombre: `Cable THHN #${calibre} (rollo 100 m)`, cantidad: arriba(metros / 100), categoria: "Eléctrico", unidad: "rollo" }
            : { nombre: `Cable THHN #${calibre}`, cantidad: metros, categoria: "Eléctrico", unidad: "m" },
          { nombre: `Breaker ${amp} A`, cantidad: 1, categoria: "Eléctrico", unidad: "und" },
        ],
        nota: `Se necesitan ${metros} m de cable (${v.hilos} hilos + 10 %). Referencia aproximada para cobre THHN; verifica con el Código Eléctrico de Costa Rica (basado en NEC).`,
      };
    },
  },
};

// Primero las calculadoras de tu oficio
function ordenadas() {
  const oficio = db.perfil.ocupacion || "";
  return Object.entries(CALCULADORAS).sort(([, a], [, b]) => (b.oficios.includes(oficio) ? 1 : 0) - (a.oficios.includes(oficio) ? 1 : 0));
}

let elegida = null;     // clave de la calculadora abierta
let valores = {};       // lo último que escribió el usuario
let resultado = null;   // el último cálculo
let listaDestino = null;

export const vistaCalculadoras = {
  tab: "listas",

  render(listaId) {
    listaDestino = buscar("listas", listaId) || null;
    const calc = elegida && CALCULADORAS[elegida];
    return `
      <a href="${listaDestino ? `#/lista/${listaDestino.id}` : "#/listas"}" class="volver">← ${listaDestino ? seguro(listaDestino.nombre) : "Mis listas"}</a>
      <div class="encabezado"><h2>🧮 Calculadoras de obra</h2></div>
      ${listaDestino ? `<p class="nota">Los resultados se agregan a <strong>${seguro(listaDestino.nombre)}</strong>.</p>` : ""}

      <div class="calculadoras">
        ${ordenadas().map(([clave, c]) => `
          <button class="calc-opcion ${clave === elegida ? "activa" : ""}" data-accion="elegir" data-calc="${clave}">
            <span class="calc-icono">${c.icono}</span>
            <strong>${c.titulo}</strong>
            <span class="nota">${c.descripcion}</span>
          </button>`).join("")}
      </div>

      ${calc ? `
        <section class="tarjeta">
          <h3>${calc.icono} ${calc.titulo}</h3>
          <form data-form="calcular" class="formulario">
            ${calc.campos.map((c) => campo(c, valores[c.nombre] ?? c.valor)).join("")}
            <button class="principal ancho">Calcular</button>
          </form>
        </section>
        ${resultado ? tarjetaResultado(resultado) : ""}` : `<p class="nota centro">Elige una calculadora 👆</p>`}`;
  },

  acciones: {
    elegir(el) {
      elegida = el.dataset.calc;
      valores = {};
      resultado = null;
      refrescar();
    },

    async agregar() {
      let lista = listaDestino;
      if (!lista) {
        const activas = db.listas.filter((l) => !l.archivada);
        const d = await formulario({
          titulo: "¿A qué lista lo agrego?", boton: "Agregar",
          campos: [{ nombre: "listaId", etiqueta: "Lista", tipo: "select", ancho: true, opciones: [
            ...activas.map((l) => ({ valor: l.id, texto: l.nombre })),
            { valor: "nueva", texto: "＋ Crear una lista nueva" },
          ] }],
        });
        if (!d) return;
        if (d.listaId === "nueva") {
          lista = { id: nuevoId(), nombre: `${CALCULADORAS[elegida].titulo} (${hoy()})`, cliente: "", direccion: "", presupuesto: 0, creada: hoy(), archivada: false, items: [] };
          db.listas.unshift(lista);
        } else lista = buscar("listas", d.listaId);
      }
      const n = agregarALista(lista, resultado.materiales);
      guardar();
      aviso(`${n} materiales agregados a "${lista.nombre}" ✓`);
      ir(`#/lista/${lista.id}`);
    },
  },

  formularios: {
    calcular(form, d) {
      const calc = CALCULADORAS[elegida];
      for (const c of calc.campos) if (c.tipo === "number") d[c.nombre] = Math.max(0, Number(d[c.nombre]) || 0);
      valores = d;
      resultado = calc.calcular(d);
      refrescar();
      document.querySelector(".resultado")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
  },
};

function campo(c, valor) {
  if (c.tipo === "select") {
    return `<label>${c.etiqueta}<select name="${c.nombre}">${c.opciones.map((o) =>
      `<option value="${o.valor}" ${String(o.valor) === String(valor) ? "selected" : ""}>${seguro(o.texto)}</option>`).join("")}</select></label>`;
  }
  return `<label>${c.etiqueta}<input name="${c.nombre}" type="number" min="0" step="any" inputmode="decimal" value="${seguro(valor)}" required></label>`;
}

function tarjetaResultado(r) {
  const materiales = r.materiales.filter((m) => m.cantidad > 0);
  return `
    <section class="tarjeta resultado">
      <h3>✅ Necesitas</h3>
      <p class="nota">${seguro(r.resumen)}</p>
      <table>
        <tbody>${materiales.map((m) => `<tr><td>${seguro(m.nombre)}</td><td class="num"><strong>${num(m.cantidad)}</strong> ${seguro(m.unidad)}</td></tr>`).join("")}</tbody>
      </table>
      ${r.nota ? `<p class="nota" style="margin-top:8px">ℹ️ ${seguro(r.nota)}</p>` : ""}
      <button class="principal ancho-total" style="margin-top:12px" data-accion="agregar">
        ➕ Agregar ${listaDestino ? `a "${seguro(listaDestino.nombre)}"` : "a una lista"}
      </button>
    </section>`;
}
