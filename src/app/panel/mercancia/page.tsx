import Link from "next/link";
import { deleteProduct } from "@/actions/catalogo";
import { ExcelDrop } from "@/components/excel-import";
import { ProductForm } from "@/components/product-form";
import { money, pct, todayISO } from "@/lib/format";
import { listProducts, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function MercanciaPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string }>;
}) {
  const { edit, error } = await searchParams;
  const [products, snap] = await Promise.all([listProducts(), loadSnapshot()]);
  const editing = edit ? products.find((p) => p.id === edit) : undefined;

  // Un producto solo se puede borrar si no aparece en ningún movimiento.
  const usados = new Set<string>();
  for (const c of snap.purchases) for (const it of c.items) usados.add(it.product_id);
  for (const a of snap.assignments) for (const it of a.items) usados.add(it.product_id);
  for (const c of snap.cortes) for (const it of c.items) usados.add(it.product_id);
  for (const r of snap.retiros) for (const it of r.items) usados.add(it.product_id);
  for (const a of snap.ajustes) for (const it of a.items) usados.add(it.product_id);
  for (const s of snap.sales) usados.add(s.product_id);

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Mercancía</h3>
            <div className="sub">Catálogo con costo y precio de venta</div>
          </div>
        </div>
        {error === "historial" && (
          <p className="notice" role="alert">
            No se pudo eliminar el producto: ya aparece en algún movimiento del negocio. Desmarca{" "}
            <b>Producto activo</b> al editarlo para retirarlo sin perder el historial.
          </p>
        )}
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th className="num">Costo</th>
                <th className="num">Precio</th>
                <th className="num">Margen</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.activo ? "" : "dim"}>
                  <td className="code">{p.codigo || "—"}</td>
                  <td>
                    {p.nombre}
                    {!p.activo && <span className="tag tag-danger">inactivo</span>}
                  </td>
                  <td>{p.categoria || <span className="dim">—</span>}</td>
                  <td className="money">{money(p.costo)}</td>
                  <td className="money">{money(p.precio)}</td>
                  <td className="money">
                    {p.precio > 0 ? pct(((p.precio - p.costo) / p.precio) * 100) : "—"}
                  </td>
                  <td className="no-print">
                    <div className="flex items-center gap-1">
                      <Link
                        className="btn btn-ghost"
                        href={`/panel/mercancia?edit=${p.id}`}
                        title="Editar producto"
                      >
                        Editar
                      </Link>
                      {!usados.has(p.id) && (
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            className="btn btn-ghost btn-danger"
                            type="submit"
                            title="Eliminar producto (no tiene movimientos)"
                          >
                            ×
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={7}>
                    Aún no hay productos en el catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>{editing ? "Editar producto" : "Nuevo producto"}</h3>
              <div className="sub">{editing ? editing.nombre : "El costo se usa para calcular ganancia"}</div>
            </div>
          </div>
          <div className="mt-4">
            <ProductForm
              product={
                editing
                  ? {
                      id: editing.id,
                      codigo: editing.codigo,
                      nombre: editing.nombre,
                      categoria: editing.categoria,
                      costo: editing.costo,
                      precio: editing.precio,
                      activo: editing.activo,
                    }
                  : undefined
              }
            />
          </div>
        </section>

        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Importar desde Excel</h3>
              <div className="sub">Código · Producto · Categoría · Costo · Precio</div>
            </div>
          </div>
          <div className="mt-4">
            <ExcelDrop
              kind="productos"
              label="Elegir archivo Excel"
              hint="El orden de las columnas da igual; los encabezados se detectan solos."
              submitLabel="Importar productos"
              fechaDefault={todayISO()}
            />
          </div>
        </section>
      </div>
    </>
  );
}
