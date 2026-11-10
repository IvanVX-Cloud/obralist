// =====================================================================
// plantillas.js — Listas listas para trabajos típicos.
// Al crear una lista nueva puedes empezar desde una de estas.
// Cantidades aproximadas: siempre revísalas según la obra.
//
// Cada material: [nombre, cantidad, categoría, unidad]
// (si el nombre existe en tu catálogo, se usa su precio y unidad)
// =====================================================================

export const PLANTILLAS = [
  {
    id: "electrica-casa", titulo: "Instalación eléctrica casa 2 habitaciones",
    oficios: ["Electricista", "Contratista", "Ingeniero/a"],
    materiales: [
      ["Cable THHN #12 (rollo 100 m)", 2, "Eléctrico", "rollo"],
      ["Cable THHN #14 (rollo 100 m)", 1, "Eléctrico", "rollo"],
      ["Centro de carga 4 espacios", 1, "Eléctrico", "und"],
      ["Breaker 20 A", 4, "Eléctrico", "und"],
      ["Tomacorriente doble", 12, "Eléctrico", "und"],
      ["Apagador sencillo", 8, "Eléctrico", "und"],
      ["Placa para toma/apagador", 20, "Eléctrico", "und"],
      ["Caja rectangular", 20, "Eléctrico", "und"],
      ["Tubo conduit PVC 1/2\" (3 m)", 40, "Eléctrico", "tubo"],
      ["Bombillo LED 9 W", 8, "Eléctrico", "und"],
      ["Cinta de aislar", 3, "Eléctrico", "und"],
    ],
  },
  {
    id: "circuito", titulo: "Agregar un circuito nuevo",
    oficios: ["Electricista"],
    materiales: [
      ["Cable THHN #12 (rollo 100 m)", 1, "Eléctrico", "rollo"],
      ["Breaker 20 A", 1, "Eléctrico", "und"],
      ["Tomacorriente doble", 4, "Eléctrico", "und"],
      ["Placa para toma/apagador", 4, "Eléctrico", "und"],
      ["Caja rectangular", 4, "Eléctrico", "und"],
      ["Tubo conduit PVC 1/2\" (3 m)", 10, "Eléctrico", "tubo"],
      ["Cinta de aislar", 1, "Eléctrico", "und"],
    ],
  },
  {
    id: "bano", titulo: "Plomería de baño completo",
    oficios: ["Fontanero", "Contratista", "Maestro de obras"],
    materiales: [
      ["Tubo PVC agua potable 1/2\" (6 m)", 4, "Plomería", "tubo"],
      ["Codo PVC 1/2\"", 12, "Plomería", "und"],
      ["Llave de paso 1/2\"", 2, "Plomería", "und"],
      ["Tubo PVC sanitario 4\" (6 m)", 2, "Plomería", "tubo"],
      ["Pegamento para PVC (1/8 gal)", 1, "Plomería", "und"],
    ],
  },
  {
    id: "pared", titulo: "Pared de block 15 (10 m²)",
    oficios: ["Albañil", "Maestro de obras", "Contratista"],
    materiales: [
      ["Block 15x20x40", 132, "Obra negra", "und"],
      ["Mortero para pegar block (saco 40 kg)", 6, "Obra negra", "saco"],
      ["Varilla #3 (3/8\") 6 m", 8, "Obra negra", "und"],
      ["Alambre negro", 2, "Obra negra", "kg"],
      ["Cemento gris (saco 50 kg)", 3, "Obra negra", "saco"],
    ],
  },
  {
    id: "piso", titulo: "Enchape de piso (20 m²)",
    oficios: ["Enchapador", "Albañil", "Maestro de obras"],
    materiales: [
      ["Piso cerámico", 22, "Acabados", "m²"],
      ["Pegamento para cerámica (saco 20 kg)", 5, "Acabados", "saco"],
      ["Fragua (bolsa 2 kg)", 3, "Acabados", "und"],
      ["Disco de corte 4 1/2\"", 2, "Herramienta", "und"],
    ],
  },
  {
    id: "pintura", titulo: "Pintura de casa (60 m²)",
    oficios: ["Pintor", "Maestro de obras", "Contratista"],
    materiales: [
      ["Pintura látex (cubeta 5 gal)", 1, "Acabados", "cubeta"],
      ["Pintura látex (galón)", 2, "Acabados", "gal"],
    ],
  },
];

// Las de tu oficio primero.
export function plantillasPara(oficio) {
  return [...PLANTILLAS].sort((a, b) => (b.oficios.includes(oficio) ? 1 : 0) - (a.oficios.includes(oficio) ? 1 : 0));
}

// Convierte una plantilla al formato que usa agregarALista().
export const materialesDe = (p) => p.materiales.map(([nombre, cantidad, categoria, unidad]) => ({ nombre, cantidad, categoria, unidad }));
