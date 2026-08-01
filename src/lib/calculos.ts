import type {
  Ajuste,
  AjusteItem,
  Assignment,
  AssignmentItem,
  Corte,
  CorteItem,
  Gasto,
  Payment,
  Product,
  Purchase,
  PurchaseItem,
  Retiro,
  RetiroItem,
  Sale,
  Seller,
} from "@/lib/types";

/**
 * Cálculos puros del negocio. No tocan la base de datos:
 * reciben un Snapshot (todo lo cargado) y devuelven posiciones y totales.
 */

export type AssignmentFull = Assignment & { items: AssignmentItem[] };
export type CorteFull = Corte & { items: CorteItem[] };
export type RetiroFull = Retiro & { items: RetiroItem[] };
export type AjusteFull = Ajuste & { items: AjusteItem[] };
export type PurchaseFull = Purchase & { items: PurchaseItem[] };

export type Snapshot = {
  sellers: Seller[];
  products: Product[];
  purchases: PurchaseFull[];
  assignments: AssignmentFull[];
  sales: Sale[];
  cortes: CorteFull[];
  payments: Payment[];
  retiros: RetiroFull[];
  ajustes: AjusteFull[];
  gastos: Gasto[];
};

/** Estado de una línea de asignación (producto entregado a un vendedor). */
export type LineState = {
  assignmentId: string;
  productId: string;
  product: string;
  categoria: string;
  asignado: number;
  vendido: number;
  recogido: number;
  ajustado: number;
  enMano: number;
  precio: number;
  costo: number;
};

export type CorteView = CorteFull & {
  importe: number;
  ganancia: number;
  pagado: number;
  saldo: number;
  vendedor: string;
};

export type ProductView = {
  productId: string;
  product: string;
  categoria: string;
  codigo: string;
  comprado: number;
  asignado: number;
  vendidoUds: number;
  vendidoMonto: number;
  enMano: number;
  almacen: number;
  enManoValor: number;
  ganancia: number;
  porVendedor: { sellerId: string; vendedor: string; enMano: number }[];
};

export const lineKey = (assignmentId: string, productId: string): string => `${assignmentId}|${productId}`;

/** Posición de cada línea de asignación: asignado − vendido − recogido − ajustado. */
export function lineStates(snap: Snapshot): Map<string, LineState> {
  const byProduct = new Map(snap.products.map((p) => [p.id, p]));
  const m = new Map<string, LineState>();
  for (const a of snap.assignments) {
    for (const it of a.items) {
      const p = byProduct.get(it.product_id);
      m.set(lineKey(a.id, it.product_id), {
        assignmentId: a.id,
        productId: it.product_id,
        product: p?.nombre ?? "?",
        categoria: p?.categoria ?? "",
        asignado: it.cantidad,
        vendido: 0,
        recogido: 0,
        ajustado: 0,
        enMano: it.cantidad,
        precio: it.precio,
        costo: it.costo,
      });
    }
  }
  for (const s of snap.sales) {
    const ls = m.get(lineKey(s.assignment_id, s.product_id));
    if (ls) ls.vendido += s.cantidad;
  }
  for (const r of snap.retiros) {
    for (const it of r.items) {
      const ls = m.get(lineKey(it.assignment_id, it.product_id));
      if (ls) ls.recogido += it.cantidad;
    }
  }
  for (const a of snap.ajustes) {
    for (const it of a.items) {
      if (!it.assignment_id) continue;
      const ls = m.get(lineKey(it.assignment_id, it.product_id));
      if (ls) ls.ajustado += it.cantidad;
    }
  }
  for (const ls of m.values()) {
    ls.enMano = Math.max(0, ls.asignado - ls.vendido - ls.recogido - ls.ajustado);
  }
  return m;
}

/** Líneas de un vendedor. */
export function sellerLines(snap: Snapshot, sellerId: string, states = lineStates(snap)): LineState[] {
  const sellerAssignments = new Set(
    snap.assignments.filter((a) => a.seller_id === sellerId).map((a) => a.id),
  );
  return [...states.values()].filter((l) => sellerAssignments.has(l.assignmentId));
}

export type SellerTotals = {
  unidadesVendidas: number;
  vendidoMonto: number;
  ganancia: number;
  enMano: number;
  enManoValor: number;
  enManoValorCosto: number;
};

export function sellerTotals(lines: LineState[]): SellerTotals {
  const t: SellerTotals = {
    unidadesVendidas: 0,
    vendidoMonto: 0,
    ganancia: 0,
    enMano: 0,
    enManoValor: 0,
    enManoValorCosto: 0,
  };
  for (const l of lines) {
    t.unidadesVendidas += l.vendido;
    t.vendidoMonto += l.vendido * l.precio;
    t.ganancia += l.vendido * (l.precio - l.costo);
    t.enMano += l.enMano;
    t.enManoValor += l.enMano * l.precio;
    t.enManoValorCosto += l.enMano * l.costo;
  }
  return t;
}

/** Cortes de un vendedor con importe, ganancia, pagado y saldo. */
export function sellerCortes(snap: Snapshot, sellerId: string): CorteView[] {
  const bySeller = new Map(snap.sellers.map((s) => [s.id, s.nombre]));
  const paidByCorte = new Map<string, number>();
  for (const p of snap.payments) {
    if (!p.corte_id) continue;
    paidByCorte.set(p.corte_id, (paidByCorte.get(p.corte_id) ?? 0) + p.monto);
  }
  const out: CorteView[] = [];
  for (const c of snap.cortes) {
    if (c.seller_id !== sellerId) continue;
    let importe = 0;
    let ganancia = 0;
    for (const it of c.items) {
      importe += it.cantidad * it.precio;
      ganancia += it.cantidad * (it.precio - it.costo);
    }
    const pagado = paidByCorte.get(c.id) ?? 0;
    out.push({
      ...c,
      importe,
      ganancia,
      pagado,
      saldo: importe - pagado,
      vendedor: bySeller.get(c.seller_id) ?? "?",
    });
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export type SellerAccount = SellerTotals & {
  totalCortado: number;
  totalPagado: number;
  debe: number;
  cortesPendientes: number;
};

export function sellerAccount(snap: Snapshot, sellerId: string, lines: LineState[]): SellerAccount {
  const cortes = sellerCortes(snap, sellerId);
  const totalCortado = cortes.reduce((s, c) => s + c.importe, 0);
  const totalPagado = snap.payments.filter((p) => p.seller_id === sellerId).reduce((s, p) => s + p.monto, 0);
  const pendientes = cortes.filter((c) => c.saldo > 0).length;
  return {
    ...sellerTotals(lines),
    totalCortado,
    totalPagado,
    debe: totalCortado - totalPagado,
    cortesPendientes: pendientes,
  };
}

/** Ventas reportadas aún no cortadas, agrupadas por producto y asignación. */
export function pendingSales(snap: Snapshot, sellerId: string): Sale[] {
  const sellerAssignments = new Set(
    snap.assignments.filter((a) => a.seller_id === sellerId).map((a) => a.id),
  );
  return snap.sales.filter((s) => !s.corte_id && sellerAssignments.has(s.assignment_id));
}

export function pendingCorteItems(
  snap: Snapshot,
  sellerId: string,
  states = lineStates(snap),
): { productId: string; product: string; cantidad: number; precio: number; costo: number }[] {
  const map = new Map<
    string,
    { productId: string; product: string; cantidad: number; precio: number; costo: number }
  >();
  for (const s of pendingSales(snap, sellerId)) {
    const ls = states.get(lineKey(s.assignment_id, s.product_id));
    const key = s.product_id;
    const cur = map.get(key) ?? {
      productId: s.product_id,
      product: ls?.product ?? "?",
      cantidad: 0,
      precio: ls?.precio ?? 0,
      costo: ls?.costo ?? 0,
    };
    cur.cantidad += s.cantidad;
    if (ls) {
      cur.precio = ls.precio;
      cur.costo = ls.costo;
    }
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.cantidad - a.cantidad);
}

/** Costo promedio ponderado de un producto según sus compras. */
export function avgCosto(snap: Snapshot, productId: string): number {
  let units = 0;
  let value = 0;
  for (const p of snap.purchases) {
    for (const it of p.items) {
      if (it.product_id === productId) {
        units += it.cantidad;
        value += it.cantidad * it.costo;
      }
    }
  }
  return units > 0 ? value / units : 0;
}

/** Posición de almacén por producto. */
export function warehouseLines(snap: Snapshot): ProductView[] {
  const byProduct = new Map(snap.products.map((p) => [p.id, p]));
  const purchased = new Map<string, number>();
  const purchasedVal = new Map<string, number>();
  for (const p of snap.purchases) {
    for (const it of p.items) {
      purchased.set(it.product_id, (purchased.get(it.product_id) ?? 0) + it.cantidad);
      purchasedVal.set(it.product_id, (purchasedVal.get(it.product_id) ?? 0) + it.cantidad * it.costo);
    }
  }
  // Un traspaso entre vendedores crea una asignación que reusa el id de la
  // recogida. Esa mercancía nunca volvió al almacén, así que no vuelve a salir
  // de él: contarla como asignada restaría dos veces las mismas unidades.
  const traspasos = new Set(snap.retiros.filter((r) => r.destino !== "almacen").map((r) => r.id));
  const assigned = new Map<string, number>();
  for (const a of snap.assignments) {
    if (traspasos.has(a.id)) continue;
    for (const it of a.items) assigned.set(it.product_id, (assigned.get(it.product_id) ?? 0) + it.cantidad);
  }
  const returned = new Map<string, number>();
  for (const r of snap.retiros) {
    if (r.destino !== "almacen") continue;
    for (const it of r.items) returned.set(it.product_id, (returned.get(it.product_id) ?? 0) + it.cantidad);
  }
  const adjusted = new Map<string, number>();
  for (const a of snap.ajustes) {
    if (a.seller_id !== null) continue;
    for (const it of a.items) adjusted.set(it.product_id, (adjusted.get(it.product_id) ?? 0) + it.cantidad);
  }

  const ids = new Set([...purchased.keys(), ...assigned.keys(), ...returned.keys(), ...adjusted.keys()]);
  const out: ProductView[] = [];
  for (const id of ids) {
    const p = byProduct.get(id);
    if (!p?.activo) continue;
    const comprado = purchased.get(id) ?? 0;
    const asignado = assigned.get(id) ?? 0;
    const stock = Math.max(0, comprado - asignado + (returned.get(id) ?? 0) - (adjusted.get(id) ?? 0));
    out.push({
      productId: id,
      product: p.nombre,
      categoria: p.categoria,
      codigo: p.codigo,
      comprado,
      asignado,
      vendidoUds: 0,
      vendidoMonto: 0,
      enMano: 0,
      almacen: stock,
      enManoValor: 0,
      ganancia: 0,
      porVendedor: [],
    });
  }
  return out.sort((a, b) => b.almacen - a.almacen);
}

const inRange = (iso: string, from?: string, to?: string): boolean =>
  (!from || iso >= from) && (!to || iso <= to);

export type GlobalMetrics = {
  ventasMonto: number;
  ganancia: number;
  gastosMonto: number;
  /** Ganancia de las ventas menos los gastos del negocio. */
  gananciaNeta: number;
  unidadesVendidas: number;
  compradoValor: number;
  asignadoValorCosto: number;
  enManoValor: number;
  enManoValorCosto: number;
  almacenValorCosto: number;
  debeTotal: number;
  cortesMonto: number;
  pagosMonto: number;
  numCortes: number;
  numPagos: number;
};

export function globalMetrics(snap: Snapshot, from?: string, to?: string): GlobalMetrics {
  const states = lineStates(snap);
  const g: GlobalMetrics = {
    ventasMonto: 0,
    ganancia: 0,
    gastosMonto: 0,
    gananciaNeta: 0,
    unidadesVendidas: 0,
    compradoValor: 0,
    asignadoValorCosto: 0,
    enManoValor: 0,
    enManoValorCosto: 0,
    almacenValorCosto: 0,
    debeTotal: 0,
    cortesMonto: 0,
    pagosMonto: 0,
    numCortes: 0,
    numPagos: 0,
  };
  for (const s of snap.sales) {
    if (!inRange(s.fecha, from, to)) continue;
    const ls = states.get(lineKey(s.assignment_id, s.product_id));
    const precio = ls?.precio ?? 0;
    const costo = ls?.costo ?? 0;
    g.ventasMonto += s.cantidad * precio;
    g.ganancia += s.cantidad * (precio - costo);
    g.unidadesVendidas += s.cantidad;
  }
  for (const p of snap.purchases) {
    for (const it of p.items) g.compradoValor += it.cantidad * it.costo;
  }
  for (const ls of states.values()) {
    g.asignadoValorCosto += ls.asignado * ls.costo;
    g.enManoValor += ls.enMano * ls.precio;
    g.enManoValorCosto += ls.enMano * ls.costo;
  }
  const wl = warehouseLines(snap);
  for (const w of wl) g.almacenValorCosto += w.almacen * avgCosto(snap, w.productId);
  for (const c of snap.cortes) {
    if (!inRange(c.fecha, from, to)) continue;
    for (const it of c.items) g.cortesMonto += it.cantidad * it.precio;
    g.numCortes++;
  }
  for (const p of snap.payments) {
    if (!inRange(p.fecha, from, to)) continue;
    g.pagosMonto += p.monto;
    g.numPagos++;
  }
  for (const gasto of snap.gastos) {
    if (!inRange(gasto.fecha, from, to)) continue;
    g.gastosMonto += gasto.monto;
  }
  g.gananciaNeta = g.ganancia - g.gastosMonto;
  g.debeTotal =
    snap.cortes.reduce((s, c) => {
      let total = 0;
      for (const it of c.items) total += it.cantidad * it.precio;
      return s + total;
    }, 0) - snap.payments.reduce((s, p) => s + p.monto, 0);
  return g;
}

/** Reporte por producto: comprado, asignado, vendido, en manos (por vendedor), almacén. */
export function productReport(snap: Snapshot): ProductView[] {
  const byProduct = new Map(snap.products.map((p) => [p.id, p]));
  const bySeller = new Map(snap.sellers.map((s) => [s.id, s.nombre]));
  const states = lineStates(snap);
  const base = warehouseLines(snap);
  const map = new Map<string, ProductView>();
  for (const w of base) map.set(w.productId, { ...w });

  for (const ls of states.values()) {
    const v = map.get(ls.productId);
    if (!v) continue;
    const p = byProduct.get(ls.productId);
    if (p && !p.activo) continue;
    v.enMano += ls.enMano;
    v.enManoValor += ls.enMano * ls.precio;
    v.vendidoUds += ls.vendido;
    v.vendidoMonto += ls.vendido * ls.precio;
    v.ganancia += ls.vendido * (ls.precio - ls.costo);
    if (ls.enMano > 0) {
      const a = snap.assignments.find((x) => x.id === ls.assignmentId);
      if (a)
        v.porVendedor.push({
          sellerId: a.seller_id,
          vendedor: bySeller.get(a.seller_id) ?? "?",
          enMano: ls.enMano,
        });
    }
  }
  return [...map.values()].sort((a, b) => b.vendidoMonto - a.vendidoMonto);
}

export type SellerRankRow = {
  sellerId: string;
  vendedor: string;
  unidades: number;
  ventas: number;
  ganancia: number;
  cobrado: number;
  debe: number;
};

/** Ranking de vendedores para el reporte global. */
export function sellerRanking(snap: Snapshot, from?: string, to?: string): SellerRankRow[] {
  const states = lineStates(snap);
  const rows = new Map<string, SellerRankRow>();
  for (const s of snap.sellers) {
    rows.set(s.id, {
      sellerId: s.id,
      vendedor: s.nombre,
      unidades: 0,
      ventas: 0,
      ganancia: 0,
      cobrado: 0,
      debe: 0,
    });
  }
  const assignSeller = new Map(snap.assignments.map((a) => [a.id, a.seller_id]));
  for (const sale of snap.sales) {
    if (!inRange(sale.fecha, from, to)) continue;
    const sellerId = assignSeller.get(sale.assignment_id);
    const r = sellerId ? rows.get(sellerId) : undefined;
    if (!r) continue;
    const ls = states.get(lineKey(sale.assignment_id, sale.product_id));
    const precio = ls?.precio ?? 0;
    const costo = ls?.costo ?? 0;
    r.unidades += sale.cantidad;
    r.ventas += sale.cantidad * precio;
    r.ganancia += sale.cantidad * (precio - costo);
  }
  for (const p of snap.payments) {
    if (!inRange(p.fecha, from, to)) continue;
    const r = rows.get(p.seller_id);
    if (r) r.cobrado += p.monto;
  }
  // `cobrado` es del periodo; `debe` es el saldo acumulado (cortes − pagos de
  // toda la historia), igual que sellerAccount: un saldo del periodo no diría nada.
  for (const c of snap.cortes) {
    const r = rows.get(c.seller_id);
    if (!r) continue;
    for (const it of c.items) r.debe += it.cantidad * it.precio;
  }
  for (const p of snap.payments) {
    const r = rows.get(p.seller_id);
    if (r) r.debe -= p.monto;
  }
  return [...rows.values()].sort((a, b) => b.ventas - a.ventas);
}

/** Serie temporal de ventas (día) y cortes (por evento) para gráficos. */
export function ventasPorDia(
  snap: Snapshot,
  from?: string,
  to?: string,
): { fecha: string; ventas: number; ganancia: number; unidades: number }[] {
  const states = lineStates(snap);
  const map = new Map<string, { fecha: string; ventas: number; ganancia: number; unidades: number }>();
  for (const s of snap.sales) {
    if (!inRange(s.fecha, from, to)) continue;
    const ls = states.get(lineKey(s.assignment_id, s.product_id));
    const precio = ls?.precio ?? 0;
    const costo = ls?.costo ?? 0;
    const cur = map.get(s.fecha) ?? { fecha: s.fecha, ventas: 0, ganancia: 0, unidades: 0 };
    cur.ventas += s.cantidad * precio;
    cur.ganancia += s.cantidad * (precio - costo);
    cur.unidades += s.cantidad;
    map.set(s.fecha, cur);
  }
  return [...map.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export type MovementKind = "venta" | "corte" | "pago" | "recogida" | "ajuste";

/** Líneas del estado de cuenta de un vendedor, cronológicas. */
export function sellerMovements(snap: Snapshot, sellerId: string, states = lineStates(snap)) {
  const assignSeller = new Map(snap.assignments.map((a) => [a.id, a.seller_id]));
  const byProduct = new Map(snap.products.map((p) => [p.id, p]));
  type Row = {
    kind: MovementKind;
    fecha: string;
    id: string;
    desc: string;
    producto?: string;
    cantidad?: number;
    monto?: number;
  };
  const rows: Row[] = [];
  for (const s of snap.sales) {
    if (assignSeller.get(s.assignment_id) !== sellerId) continue;
    rows.push({
      kind: "venta",
      fecha: s.fecha,
      id: s.id,
      desc: s.corte_id ? "Venta (cortada)" : "Venta",
      producto: byProduct.get(s.product_id)?.nombre ?? "?",
      cantidad: s.cantidad,
      monto: (states.get(lineKey(s.assignment_id, s.product_id))?.precio ?? 0) * s.cantidad,
    });
  }
  for (const c of snap.cortes) {
    if (c.seller_id !== sellerId) continue;
    let importe = 0;
    for (const it of c.items) importe += it.cantidad * it.precio;
    rows.push({
      kind: "corte",
      fecha: c.fecha,
      id: c.id,
      desc: `Corte de venta${c.nota ? ` — ${c.nota}` : ""}`,
      monto: importe,
    });
  }
  for (const p of snap.payments) {
    if (p.seller_id !== sellerId) continue;
    rows.push({
      kind: "pago",
      fecha: p.fecha,
      id: p.id,
      desc: `Pago${p.nota ? ` — ${p.nota}` : ""}`,
      monto: p.monto,
    });
  }
  for (const r of snap.retiros) {
    if (r.seller_id !== sellerId) continue;
    const n = r.items.reduce((s, i) => s + i.cantidad, 0);
    rows.push({
      kind: "recogida",
      fecha: r.fecha,
      id: r.id,
      desc: r.destino === "almacen" ? "Recogida al almacén" : "Traspaso a otro vendedor",
      cantidad: n,
    });
  }
  return rows.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
}
