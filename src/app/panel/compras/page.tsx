import { deletePurchase } from "@/actions/catalogo";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ExcelDrop } from "@/components/excel-import";
import { PurchaseForm } from "@/components/purchase-assignment-forms";
import { money, qty, todayISO } from "@/lib/format";
import { listProducts, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
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
        {error && (
          <p className="notice" role="alert">
            No se puede eliminar esa compra: de <b>{error}</b> ya salió mercancía del almacén hacia los
            vendedores. Recoge o ajusta esas unidades antes de borrarla.
          </p>
        )}
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
                        <ConfirmSubmit
                          title="Eliminar compra"
                          titulo={`¿Eliminar la compra del ${c.fecha}?`}
                          detalle={
                            <>
                              Son <b>{qty(unidades)}</b> unidades por <b>{money(valor)}</b>. Saldrán del
                              almacén y el costo promedio se recalculará sin ellas.
                            </>
                          }
                        >
                          ×
                        </ConfirmSubmit>
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
              almacenes={snap.almacenes.filter((a) => a.activo).map((a) => ({ id: a.id, nombre: a.nombre }))}
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
              kind="compras"
              label="Elegir archivo Excel"
              hint="Los productos deben existir en el catálogo (se emparejan por código o nombre)."
              submitLabel="Importar compras"
              fechaDefault={todayISO()}
            />
          </div>
        </section>
      </div>
    </>
  );
}
