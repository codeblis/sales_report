import { deletePurchase, importPurchases } from "@/actions/catalogo";
import { ExcelDrop } from "@/components/excel-import";
import { PurchaseForm } from "@/components/purchase-assignment-forms";
import { money, qty, todayISO } from "@/lib/format";
import { parsePurchases } from "@/lib/parse";
import { listProducts, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function ComprasPage() {
  const [snap, products] = await Promise.all([loadSnapshot(), listProducts()]);
  const compras = [...snap.purchases].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Compras</h3>
            <div className="sub">Lotes de mercancía con su costo unitario</div>
          </div>
        </div>
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nota</th>
                <th className="num">Productos</th>
                <th className="num">Unidades</th>
                <th className="num">Valor</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => {
                const unidades = c.items.reduce((s, i) => s + i.cantidad, 0);
                const valor = c.items.reduce((s, i) => s + i.cantidad * i.costo, 0);
                return (
                  <tr key={c.id}>
                    <td>{c.fecha}</td>
                    <td>{c.nota || <span className="dim">—</span>}</td>
                    <td className="num">{qty(c.items.length)}</td>
                    <td className="num">{qty(unidades)}</td>
                    <td className="money">{money(valor)}</td>
                    <td className="no-print">
                      <form action={deletePurchase}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn btn-ghost btn-danger" type="submit" title="Eliminar compra">
                          ×
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {compras.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={6}>
                    Aún no hay compras registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Registrar compra</h3>
              <div className="sub">Cada producto con la cantidad y el costo de compra</div>
            </div>
          </div>
          <div className="mt-4">
            <PurchaseForm
              products={products.map((p) => ({
                id: p.id,
                nombre: p.nombre,
                costo: p.costo,
                precio: p.precio,
              }))}
              fechaDefault={todayISO()}
            />
          </div>
        </section>

        <section className="glass card">
          <div className="card-h">
            <div>
              <h3>Importar desde Excel</h3>
              <div className="sub">Fecha · Producto o Código · Cantidad · Costo</div>
            </div>
          </div>
          <div className="mt-4">
            <ExcelDrop
              label="Elegir archivo Excel"
              hint="Los productos deben existir en el catálogo (se emparejan por código o nombre)."
              parse={(sheet) => parsePurchases(sheet, todayISO())}
              submit={(rows) => {
                const fd = new FormData();
                fd.append("rows", JSON.stringify(rows));
                fd.append("fecha", todayISO());
                return importPurchases({}, fd);
              }}
              submitLabel="Importar compras"
            />
          </div>
        </section>
      </div>
    </>
  );
}
