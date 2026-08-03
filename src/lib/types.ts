export type Seller = {
  id: string;
  nombre: string;
  telefono: string;
  pin_hash: string;
  token: string;
  activo: number;
  creado: string;
  last_login: string | null;
};

export type Product = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  costo: number;
  precio: number;
  activo: number;
  creado: string;
};

/** País del almacén. Marca si hace falta un envío para llegar a los vendedores. */
export type Pais = "eeuu" | "cuba";

export type Almacen = { id: string; nombre: string; pais: Pais; activo: number; creado: string };

/**
 * Un envío mueve mercancía de un almacén a otro, o de un almacén directo a un
 * vendedor, y cuesta dinero. Mientras está en `transito` la mercancía no está en
 * ninguno de los dos extremos.
 */
export type Envio = {
  id: string;
  fecha: string;
  origen_id: string;
  destino_tipo: "almacen" | "vendedor";
  destino_id: string;
  costo: number;
  nota: string;
  estado: "transito" | "recibido";
  fecha_llegada: string | null;
};
export type EnvioItem = { envio_id: string; product_id: string; cantidad: number; precio: number };

export type Purchase = {
  id: string;
  fecha: string;
  nota: string;
  ubicacion: Pais;
  almacen_id: string;
};
export type PurchaseItem = {
  purchase_id: string;
  product_id: string;
  cantidad: number;
  costo: number;
};

export type Assignment = {
  id: string;
  seller_id: string;
  fecha: string;
  nota: string;
  /** Lo que costó hacerle llegar la mercancía. No entra en el costo unitario. */
  costo_distribucion: number;
  /** De qué almacén salió. */
  almacen_id: string | null;
};
export type AssignmentItem = {
  assignment_id: string;
  product_id: string;
  cantidad: number;
  precio: number;
  costo: number;
};

export type Corte = { id: string; seller_id: string; fecha: string; nota: string };
export type CorteItem = {
  corte_id: string;
  product_id: string;
  cantidad: number;
  precio: number;
  costo: number;
};

export type Sale = {
  id: string;
  assignment_id: string;
  product_id: string;
  cantidad: number;
  fecha: string;
  corte_id: string | null;
};

export type Payment = {
  id: string;
  seller_id: string;
  corte_id: string | null;
  monto: number;
  fecha: string;
  nota: string;
};

export type Retiro = {
  id: string;
  seller_id: string;
  fecha: string;
  destino: string;
  nota: string;
  costo_distribucion: number;
  /** A qué almacén concreto entró, cuando `destino` es "almacen". */
  destino_almacen_id: string | null;
};
export type RetiroItem = {
  retiro_id: string;
  assignment_id: string;
  product_id: string;
  cantidad: number;
};

export type Ajuste = {
  id: string;
  seller_id: string | null;
  fecha: string;
  nota: string;
  /** De qué almacén sale la baja, cuando no es de un vendedor. */
  almacen_id: string | null;
};
export type AjusteItem = {
  ajuste_id: string;
  assignment_id: string | null;
  product_id: string;
  cantidad: number;
};

export type Gasto = { id: string; fecha: string; concepto: string; categoria: string; monto: number };

export type Settings = {
  moneda_simbolo: string;
  moneda_codigo: string;
  admin_pin_hash: string | null;
};

/** Columna por fila: tablas maestras mínimas para cada pantalla. */
export type SellerBrief = Pick<Seller, "id" | "nombre" | "telefono" | "activo">;
export type ProductBrief = Pick<
  Product,
  "id" | "codigo" | "nombre" | "categoria" | "costo" | "precio" | "activo"
>;
