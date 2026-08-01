import Link from "next/link";
import { importProducts } from "@/actions/catalogo";
import { ExcelDrop } from "@/components/excel-import";
import { ProductForm } from "@/components/product-form";
import { money, pct } from "@/lib/format";
import { parseProducts } from "@/lib/parse";
import { listProducts } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function MercanciaPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const products = await listProducts();
  const editing = edit ? products.find((p) => p.id === edit) : undefined;

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Mercancía</h3>
            <div className="sub">Catálogo con costo y precio de venta</div>
          </div>
        </div>
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
                    <Link
                      className="btn btn-ghost"
                      href={`/panel/mercancia?edit=${p.id}`}
                      title="Editar producto"
                    >
                      Editar
                    </Link>
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
              label="Elegir archivo Excel"
              hint="El orden de las columnas da igual; los encabezados se detectan solos."
              parse={parseProducts}
              submit={(rows) => {
                const fd = new FormData();
                fd.append("rows", JSON.stringify(rows));
                return importProducts({}, fd);
              }}
              submitLabel="Importar productos"
            />
          </div>
        </section>
      </div>
    </>
  );
}
