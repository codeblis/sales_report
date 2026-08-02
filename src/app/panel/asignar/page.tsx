import Link from "next/link";
import { deleteAssignment } from "@/actions/catalogo";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { AssignmentForm } from "@/components/purchase-assignment-forms";
import { money, qty, todayISO } from "@/lib/format";
import { listProducts, listSellers, loadSnapshot } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function AsignarPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const [snap, products, sellers] = await Promise.all([loadSnapshot(), listProducts(), listSellers()]);
  const activos = sellers.filter((s) => s.activo);
  const bySeller = new Map(snap.sellers.map((s) => [s.id, s.nombre]));
  const asignaciones = [...snap.assignments].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 20);
  const salesCount = new Map<string, number>();
  for (const s of snap.sales) {
    salesCount.set(s.assignment_id, (salesCount.get(s.assignment_id) ?? 0) + 1);
  }

  return (
    <>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Asignar mercancía</h3>
            <div className="sub">Entrega física a un vendedor: cantidad y precio por producto</div>
          </div>
        </div>
        <div className="mt-4">
          <AssignmentForm
            products={products.map((p) => ({ id: p.id, nombre: p.nombre, costo: p.costo, precio: p.precio }))}
            sellers={activos.map((s) => ({ id: s.id, nombre: s.nombre }))}
            fechaDefault={todayISO()}
          />
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Asignaciones recientes</h3>
            <div className="sub">Solo se pueden eliminar si no tienen ventas</div>
          </div>
        </div>
        {error === "ventas" && (
          <p className="notice" role="alert">
            No se pudo eliminar la asignación: el vendedor ya reportó ventas sobre ella. Borra primero esas
            ventas si de verdad quieres deshacerla.
          </p>
        )}
        <div className="tscroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Nota</th>
                <th className="num">Productos</th>
                <th className="num">Unidades</th>
                <th className="num">Valor a precio</th>
                <th className="no-print"> </th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((a) => {
                const unidades = a.items.reduce((s, i) => s + i.cantidad, 0);
                const valor = a.items.reduce((s, i) => s + i.cantidad * i.precio, 0);
                const conVentas = (salesCount.get(a.id) ?? 0) > 0;
                return (
                  <tr key={a.id}>
                    <td>{a.fecha}</td>
                    <td>
                      <Link href={`/panel/vendedores/${a.seller_id}`} style={{ color: "inherit" }}>
                        {bySeller.get(a.seller_id) ?? "?"}
                      </Link>
                    </td>
                    <td>{a.nota || <span className="dim">—</span>}</td>
                    <td className="num">{qty(a.items.length)}</td>
                    <td className="num">{qty(unidades)}</td>
                    <td className="money">{money(valor)}</td>
                    <td className="no-print">
                      {!conVentas && (
                        <form action={deleteAssignment}>
                          <input type="hidden" name="id" value={a.id} />
                          <ConfirmSubmit
                            title="Eliminar asignación"
                            titulo={`¿Eliminar la asignación del ${a.fecha}?`}
                            detalle={
                              <>
                                Son <b>{qty(unidades)}</b> unidades de{" "}
                                <b>{bySeller.get(a.seller_id) ?? "?"}</b>. Volverán al almacén.
                              </>
                            }
                          >
                            ×
                          </ConfirmSubmit>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {asignaciones.length === 0 && (
                <tr>
                  <td className="nodata" colSpan={7}>
                    Todavía no hay asignaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
