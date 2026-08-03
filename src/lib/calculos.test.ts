import { describe, expect, it } from "vitest";

import {
  almacenStock,
  avgCosto,
  globalMetrics,
  lineKey,
  lineStates,
  pendingCorteItems,
  type Snapshot,
  sellerAccount,
  sellerCortes,
  sellerLines,
  sellerMovements,
  sellerRanking,
  sellerTotals,
  stockEnTransito,
  warehouseLines,
  warehouseStock,
} from "@/lib/calculos";
import type { Product, Seller } from "@/lib/types";

/* ---------------- Fábricas ----------------
 * Un mundo mínimo pero realista: se compran 100 unidades a 5 y se le entregan
 * 10 a un vendedor, que las vende a 10. Así el almacén arranca en 90 y cada
 * prueba mueve solo la pieza que le interesa.
 */

const vendedor = (id: string, nombre = id): Seller => ({
  id,
  nombre,
  telefono: "",
  pin_hash: "",
  token: `tok-${id}`,
  activo: 1,
  creado: "2026-01-01",
  last_login: null,
});

const producto = (id: string, costo = 5, precio = 10): Product => ({
  id,
  codigo: id.toUpperCase(),
  nombre: `Producto ${id}`,
  categoria: "general",
  costo,
  precio,
  activo: 1,
  creado: "2026-01-01",
});

const compra = (
  id: string,
  fecha: string,
  items: [string, number, number][],
  ubicacion: "eeuu" | "cuba" = "eeuu",
) => ({
  id,
  fecha,
  nota: "",
  ubicacion,
  almacen_id: ubicacion === "cuba" ? "alm-cuba" : "alm-eeuu",
  items: items.map(([product_id, cantidad, costo]) => ({
    purchase_id: id,
    product_id,
    cantidad,
    costo,
  })),
});

const asignacion = (
  id: string,
  seller_id: string,
  fecha: string,
  items: [string, number, number, number][],
) => ({
  id,
  seller_id,
  fecha,
  nota: "",
  costo_distribucion: 0,
  almacen_id: "alm-cuba",
  items: items.map(([product_id, cantidad, precio, costo]) => ({
    assignment_id: id,
    product_id,
    cantidad,
    precio,
    costo,
  })),
});

const venta = (
  id: string,
  assignment_id: string,
  product_id: string,
  cantidad: number,
  fecha: string,
  corte_id: string | null = null,
) => ({ id, assignment_id, product_id, cantidad, fecha, corte_id });

const corte = (id: string, seller_id: string, fecha: string, items: [string, number, number, number][]) => ({
  id,
  seller_id,
  fecha,
  nota: "",
  items: items.map(([product_id, cantidad, precio, costo]) => ({
    corte_id: id,
    product_id,
    cantidad,
    precio,
    costo,
  })),
});

const retiro = (
  id: string,
  seller_id: string,
  fecha: string,
  destino: string,
  items: [string, string, number][],
) => ({
  id,
  seller_id,
  fecha,
  destino,
  nota: "",
  costo_distribucion: 0,
  destino_almacen_id: destino === "almacen" ? "alm-cuba" : null,
  items: items.map(([assignment_id, product_id, cantidad]) => ({
    retiro_id: id,
    assignment_id,
    product_id,
    cantidad,
  })),
});

const ajuste = (
  id: string,
  seller_id: string | null,
  fecha: string,
  items: [string | null, string, number][],
) => ({
  id,
  seller_id,
  fecha,
  nota: "",
  almacen_id: seller_id === null ? "alm-cuba" : null,
  items: items.map(([assignment_id, product_id, cantidad]) => ({
    ajuste_id: id,
    assignment_id,
    product_id,
    cantidad,
  })),
});

const envio = (
  id: string,
  origen_id: string,
  destino_tipo: "almacen" | "vendedor",
  destino_id: string,
  fecha: string,
  items: [string, number, number][],
  estado: "transito" | "recibido" = "transito",
  costo = 0,
) => ({
  id,
  fecha,
  origen_id,
  destino_tipo,
  destino_id,
  costo,
  nota: "",
  estado,
  fecha_llegada: estado === "recibido" ? fecha : null,
  items: items.map(([product_id, cantidad, precio]) => ({
    envio_id: id,
    product_id,
    cantidad,
    precio,
  })),
});

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  sellers: [vendedor("A", "Ana"), vendedor("B", "Beto")],
  products: [producto("p")],
  purchases: [compra("c1", "2026-01-01", [["p", 100, 5]])],
  assignments: [asignacion("a1", "A", "2026-01-02", [["p", 10, 10, 5]])],
  sales: [],
  cortes: [],
  payments: [],
  retiros: [],
  ajustes: [],
  gastos: [],
  almacenes: [
    { id: "alm-eeuu", nombre: "Almacén de Estados Unidos", pais: "eeuu", activo: 1, creado: "2026-01-01" },
    { id: "alm-cuba", nombre: "Almacén de Cuba", pais: "cuba", activo: 1, creado: "2026-01-01" },
  ],
  envios: [],
  ...over,
});

const linea = (snap: Snapshot, assignmentId = "a1", productId = "p") =>
  lineStates(snap).get(lineKey(assignmentId, productId));

const almacenDe = (snap: Snapshot, productId = "p") =>
  warehouseLines(snap).find((w) => w.productId === productId)?.almacen ?? 0;

/* ---------------- lineStates ---------------- */

describe("lineStates", () => {
  it("sin movimientos, lo asignado sigue en mano", () => {
    const l = linea(snapshot());
    expect(l?.asignado).toBe(10);
    expect(l?.enMano).toBe(10);
  });

  it("descuenta ventas, recogidas y ajustes de la misma línea", () => {
    const snap = snapshot({
      sales: [venta("v1", "a1", "p", 4, "2026-01-03")],
      retiros: [retiro("r1", "A", "2026-01-04", "almacen", [["a1", "p", 2]])],
      ajustes: [ajuste("aj1", "A", "2026-01-05", [["a1", "p", 1]])],
    });
    const l = linea(snap);
    expect(l?.vendido).toBe(4);
    expect(l?.recogido).toBe(2);
    expect(l?.ajustado).toBe(1);
    expect(l?.enMano).toBe(3); // 10 − 4 − 2 − 1
  });

  it("nunca deja el saldo en negativo", () => {
    const snap = snapshot({ sales: [venta("v1", "a1", "p", 999, "2026-01-03")] });
    expect(linea(snap)?.enMano).toBe(0);
  });

  it("ignora los ajustes de almacén, que no tocan a ningún vendedor", () => {
    const snap = snapshot({ ajustes: [ajuste("aj1", null, "2026-01-05", [[null, "p", 3]])] });
    expect(linea(snap)?.enMano).toBe(10);
  });
});

/* ---------------- warehouseLines ---------------- */

describe("warehouseLines", () => {
  it("descuenta del almacén lo que se asigna", () => {
    expect(almacenDe(snapshot())).toBe(90); // 100 compradas − 10 asignadas
  });

  it("un traspaso entre vendedores no mueve el almacén", () => {
    // El traspaso crea una asignación que reusa el id de la recogida. Esa
    // mercancía nunca volvió al almacén, así que no puede volver a salir.
    const snap = snapshot({
      assignments: [
        asignacion("a1", "A", "2026-01-02", [["p", 10, 10, 5]]),
        asignacion("r1", "B", "2026-01-03", [["p", 10, 10, 5]]),
      ],
      retiros: [retiro("r1", "A", "2026-01-03", "B", [["a1", "p", 10]])],
    });
    expect(almacenDe(snap)).toBe(90);
  });

  it("una recogida al almacén sí devuelve el stock", () => {
    const snap = snapshot({
      retiros: [retiro("r1", "A", "2026-01-04", "almacen", [["a1", "p", 4]])],
    });
    expect(almacenDe(snap)).toBe(94);
  });

  it("un ajuste de almacén baja las existencias", () => {
    const snap = snapshot({ ajustes: [ajuste("aj1", null, "2026-01-05", [[null, "p", 5]])] });
    expect(almacenDe(snap)).toBe(85);
  });

  it("deja fuera los productos inactivos", () => {
    const snap = snapshot({ products: [{ ...producto("p"), activo: 0 }] });
    expect(warehouseLines(snap)).toHaveLength(0);
  });

  it("enseña el negativo cuando se asignó de más, en vez de recortarlo a cero", () => {
    // Antes se recortaba con Math.max(0, …), así que asignar 120 de 100 dejaba
    // el almacén "agotado" en lugar de delatar que la cuenta era imposible.
    const snap = snapshot({
      assignments: [asignacion("a1", "A", "2026-01-02", [["p", 120, 10, 5]])],
    });
    expect(almacenDe(snap)).toBe(-20);
  });
});

/* ---------------- warehouseStock ---------------- */

describe("warehouseStock", () => {
  it("cuenta compras, asignaciones, devoluciones y mermas", () => {
    const snap = snapshot({
      retiros: [retiro("r1", "A", "2026-01-04", "almacen", [["a1", "p", 4]])],
      ajustes: [ajuste("aj1", null, "2026-01-05", [[null, "p", 5]])],
    });
    // 100 compradas − 10 asignadas + 4 devueltas − 5 mermadas
    expect(warehouseStock(snap).get("p")).toBe(89);
  });

  it("no cuenta la merma de un vendedor como salida del almacén", () => {
    // Esa mercancía ya había salido al asignarla: restarla otra vez la contaría dos veces.
    const snap = snapshot({ ajustes: [ajuste("aj1", "A", "2026-01-05", [["a1", "p", 3]])] });
    expect(warehouseStock(snap).get("p")).toBe(90);
  });

  it("un producto sin movimientos no tiene existencias", () => {
    expect(warehouseStock(snapshot()).get("desconocido")).toBeUndefined();
  });
});

/* ---------------- avgCosto ---------------- */

describe("avgCosto", () => {
  it("pondera por cantidad, no por número de compras", () => {
    const snap = snapshot({
      purchases: [
        compra("c1", "2026-01-01", [["p", 10, 4]]), // 40
        compra("c2", "2026-01-02", [["p", 30, 8]]), // 240
      ],
    });
    expect(avgCosto(snap, "p")).toBe(7); // 280 / 40
  });

  it("devuelve 0 si no hay compras del producto", () => {
    expect(avgCosto(snapshot({ purchases: [] }), "p")).toBe(0);
  });
});

/* ---------------- Totales y cuenta del vendedor ---------------- */

describe("sellerTotals y sellerAccount", () => {
  it("suma lo vendido y la ganancia sobre precio menos costo", () => {
    const snap = snapshot({ sales: [venta("v1", "a1", "p", 4, "2026-01-03")] });
    const t = sellerTotals(sellerLines(snap, "A"));
    expect(t.unidadesVendidas).toBe(4);
    expect(t.vendidoMonto).toBe(40); // 4 × 10
    expect(t.ganancia).toBe(20); // 4 × (10 − 5)
    expect(t.enMano).toBe(6);
    expect(t.enManoValor).toBe(60);
  });

  it("un producto agotado sigue contando en lo vendido", () => {
    // El portal del vendedor filtraba `enMano > 0` antes de totalizar, así que
    // esta venta desaparecía de sus cifras en cuanto agotaba el producto.
    const snap = snapshot({ sales: [venta("v1", "a1", "p", 10, "2026-01-03")] });
    const todas = sellerLines(snap, "A");
    expect(todas.find((l) => l.productId === "p")?.enMano).toBe(0);
    expect(sellerTotals(todas).unidadesVendidas).toBe(10);
    // Filtrar antes de totalizar es justo lo que lo rompía:
    expect(sellerTotals(todas.filter((l) => l.enMano > 0)).unidadesVendidas).toBe(0);
  });

  it("la deuda es lo cortado menos lo pagado", () => {
    const snap = snapshot({
      cortes: [corte("co1", "A", "2026-02-01", [["p", 10, 10, 5]])],
      payments: [{ id: "pa1", seller_id: "A", corte_id: "co1", monto: 60, fecha: "2026-02-02", nota: "" }],
    });
    const acct = sellerAccount(snap, "A", sellerLines(snap, "A"));
    expect(acct.totalCortado).toBe(100);
    expect(acct.totalPagado).toBe(60);
    expect(acct.debe).toBe(40);
    expect(acct.cortesPendientes).toBe(1);
  });

  it("un corte saldado deja de contar como pendiente", () => {
    const snap = snapshot({
      cortes: [corte("co1", "A", "2026-02-01", [["p", 10, 10, 5]])],
      payments: [{ id: "pa1", seller_id: "A", corte_id: "co1", monto: 100, fecha: "2026-02-02", nota: "" }],
    });
    expect(sellerCortes(snap, "A")[0].saldo).toBe(0);
    expect(sellerAccount(snap, "A", sellerLines(snap, "A")).cortesPendientes).toBe(0);
  });
});

/* ---------------- sellerRanking ---------------- */

describe("sellerRanking", () => {
  const conDeuda = snapshot({
    cortes: [corte("co1", "A", "2026-02-01", [["p", 10, 10, 5]])],
    payments: [{ id: "pa1", seller_id: "A", corte_id: "co1", monto: 60, fecha: "2026-02-02", nota: "" }],
  });

  it("la deuda descuenta los pagos, igual que sellerAccount", () => {
    const ana = sellerRanking(conDeuda).find((r) => r.sellerId === "A");
    expect(ana?.debe).toBe(40);
  });

  it("la deuda es acumulada aunque lo cobrado sea del periodo", () => {
    const ana = sellerRanking(conDeuda, "2026-03-01", "2026-03-31").find((r) => r.sellerId === "A");
    expect(ana?.debe).toBe(40);
    expect(ana?.cobrado).toBe(0);
  });

  it("atribuye la venta al dueño de la asignación", () => {
    const snap = snapshot({ sales: [venta("v1", "a1", "p", 4, "2026-01-03")] });
    const filas = sellerRanking(snap);
    expect(filas.find((r) => r.sellerId === "A")?.ventas).toBe(40);
    expect(filas.find((r) => r.sellerId === "B")?.ventas).toBe(0);
  });
});

/* ---------------- globalMetrics ---------------- */

describe("globalMetrics", () => {
  const conGastos = snapshot({
    sales: [venta("v1", "a1", "p", 10, "2026-02-01")],
    gastos: [
      { id: "g1", fecha: "2026-02-05", concepto: "Renta", categoria: "local", monto: 20 },
      { id: "g2", fecha: "2026-05-01", concepto: "Fuera de rango", categoria: "", monto: 500 },
    ],
  });

  it("la ganancia neta descuenta los gastos del periodo", () => {
    const g = globalMetrics(conGastos, "2026-02-01", "2026-02-28");
    expect(g.ganancia).toBe(50); // 10 × (10 − 5)
    expect(g.gastosMonto).toBe(20); // solo el de febrero
    expect(g.gananciaNeta).toBe(30);
  });

  it("sin filtro entran todos los gastos", () => {
    const g = globalMetrics(conGastos);
    expect(g.gastosMonto).toBe(520);
    expect(g.gananciaNeta).toBe(-470);
  });

  it("las cuentas por cobrar son cortes menos pagos", () => {
    const snap = snapshot({
      cortes: [corte("co1", "A", "2026-02-01", [["p", 10, 10, 5]])],
      payments: [{ id: "pa1", seller_id: "A", corte_id: "co1", monto: 60, fecha: "2026-02-02", nota: "" }],
    });
    expect(globalMetrics(snap).debeTotal).toBe(40);
  });
});

/* ---------------- pendingCorteItems ---------------- */

describe("pendingCorteItems", () => {
  it("agrupa por producto solo lo que no se ha cortado", () => {
    const snap = snapshot({
      sales: [
        venta("v1", "a1", "p", 2, "2026-01-03"),
        venta("v2", "a1", "p", 3, "2026-01-04"),
        venta("v3", "a1", "p", 5, "2026-01-05", "co1"), // ya cortada
      ],
    });
    const pend = pendingCorteItems(snap, "A");
    expect(pend).toHaveLength(1);
    expect(pend[0].cantidad).toBe(5); // 2 + 3, sin la cortada
    expect(pend[0].precio).toBe(10);
  });
});

/* ---------------- sellerMovements ---------------- */

describe("sellerMovements", () => {
  it("emite las cinco clases de movimiento, incluidos los ajustes", () => {
    const snap = snapshot({
      sales: [venta("v1", "a1", "p", 4, "2026-01-03")],
      cortes: [corte("co1", "A", "2026-02-01", [["p", 4, 10, 5]])],
      payments: [{ id: "pa1", seller_id: "A", corte_id: "co1", monto: 40, fecha: "2026-02-02", nota: "" }],
      retiros: [retiro("r1", "A", "2026-01-04", "almacen", [["a1", "p", 2]])],
      ajustes: [ajuste("aj1", "A", "2026-01-05", [["a1", "p", 1]])],
    });
    const kinds = sellerMovements(snap, "A").map((m) => m.kind);
    expect(new Set(kinds)).toEqual(new Set(["venta", "corte", "pago", "recogida", "ajuste"]));
  });

  it("el ajuste lleva la cantidad y el producto cuando es de uno solo", () => {
    const snap = snapshot({ ajustes: [ajuste("aj1", "A", "2026-01-05", [["a1", "p", 3]])] });
    const m = sellerMovements(snap, "A").find((x) => x.kind === "ajuste");
    expect(m?.cantidad).toBe(3);
    expect(m?.producto).toBe("Producto p");
  });

  it("ordena cronológicamente", () => {
    const snap = snapshot({
      sales: [venta("v1", "a1", "p", 1, "2026-03-01")],
      retiros: [retiro("r1", "A", "2026-01-04", "almacen", [["a1", "p", 1]])],
    });
    expect(sellerMovements(snap, "A").map((m) => m.fecha)).toEqual(["2026-01-04", "2026-03-01"]);
  });

  it("no mezcla movimientos de otro vendedor", () => {
    const snap = snapshot({
      payments: [{ id: "pa1", seller_id: "B", corte_id: null, monto: 10, fecha: "2026-02-02", nota: "" }],
    });
    expect(sellerMovements(snap, "A")).toHaveLength(0);
  });
});

/* ---------------- Cadena EEUU → Cuba ---------------- */

describe("almacenStock y stockEnTransito", () => {
  // La compra entra en Miami; nada llega a Cuba hasta que un envío se recibe.
  const enEeuu = (over = {}) =>
    snapshot({ purchases: [compra("c1", "2026-01-01", [["p", 100, 5]])], assignments: [], ...over });

  it("la compra se queda en el almacén donde entró", () => {
    const snap = enEeuu();
    expect(almacenStock(snap, "alm-eeuu").get("p")).toBe(100);
    expect(almacenStock(snap, "alm-cuba").get("p")).toBeUndefined();
  });

  it("un envío en tránsito ya salió de origen pero aún no está en destino", () => {
    const snap = enEeuu({
      envios: [envio("e1", "alm-eeuu", "almacen", "alm-cuba", "2026-01-05", [["p", 30, 10]])],
    });
    expect(almacenStock(snap, "alm-eeuu").get("p")).toBe(70);
    expect(almacenStock(snap, "alm-cuba").get("p") ?? 0).toBe(0);
    expect(stockEnTransito(snap).get("p")).toBe(30);
  });

  it("al recibirse, la mercancía aterriza en el almacén de destino", () => {
    const snap = enEeuu({
      envios: [envio("e1", "alm-eeuu", "almacen", "alm-cuba", "2026-01-05", [["p", 30, 10]], "recibido")],
    });
    expect(almacenStock(snap, "alm-eeuu").get("p")).toBe(70);
    expect(almacenStock(snap, "alm-cuba").get("p")).toBe(30);
    expect(stockEnTransito(snap).get("p")).toBeUndefined();
  });

  it("un envío directo a un vendedor no suma a ningún almacén", () => {
    const snap = enEeuu({
      envios: [envio("e1", "alm-eeuu", "vendedor", "A", "2026-01-05", [["p", 12, 10]], "recibido")],
    });
    expect(almacenStock(snap, "alm-eeuu").get("p")).toBe(88);
    expect(almacenStock(snap, "alm-cuba").get("p") ?? 0).toBe(0);
  });

  it("la compra en Cuba se salta el envío", () => {
    const snap = snapshot({
      purchases: [compra("c1", "2026-01-01", [["p", 40, 5]], "cuba")],
      assignments: [],
    });
    expect(almacenStock(snap, "alm-cuba").get("p")).toBe(40);
    expect(almacenStock(snap, "alm-eeuu").get("p")).toBeUndefined();
  });

  it("asignar descuenta del almacén del que sale, no de otro", () => {
    const snap = snapshot({
      purchases: [compra("c1", "2026-01-01", [["p", 40, 5]], "cuba")],
      assignments: [asignacion("a1", "A", "2026-01-02", [["p", 10, 10, 5]])],
    });
    expect(almacenStock(snap, "alm-cuba").get("p")).toBe(30);
    expect(almacenStock(snap, "alm-eeuu").get("p") ?? 0).toBe(0);
  });
});
