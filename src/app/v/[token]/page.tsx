import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { ThemeToggle } from "@/components/theme-toggle";
import { VendorLogin } from "@/components/vendor-login";
import { VendorPortal } from "@/components/vendor-portal";
import { checkSellerToken, sellerCookieName } from "@/lib/auth";
import { lineStates, pendingCorteItems, sellerAccount, sellerLines, sellerTotals } from "@/lib/calculos";
import { getSellerByToken, loadSnapshot } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function VendorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const seller = await getSellerByToken(token);
  if (!seller) notFound();
  if (seller.activo !== 1) notFound();

  const c = await cookies();
  const authed = await checkSellerToken(c.get(sellerCookieName(token))?.value, seller.id);

  return (
    <div className="shell" style={{ maxWidth: 880 }}>
      <header className="masthead">
        <div className="brand">
          <div className="sigil" aria-hidden="true" />
          <div>
            <h1>{authed ? `Reportes de ${seller.nombre}` : "Portal del vendedor"}</h1>
            <p className="srcline">
              {authed ? "Reporta tus ventas y revisa tu saldo" : "Acceso con PIN de vendedor"}
            </p>
          </div>
        </div>
        <div className="tools no-print">
          <ThemeToggle />
        </div>
      </header>

      {authed ? (
        <VendorContent token={token} seller={seller} />
      ) : (
        <VendorLogin token={token} nombre={seller.nombre} />
      )}
    </div>
  );
}

async function VendorContent({
  token,
  seller,
}: {
  token: string;
  seller: { id: string; nombre: string; telefono: string };
}) {
  const snap = await loadSnapshot();
  const states = lineStates(snap);
  const lines = sellerLines(snap, seller.id, states)
    .filter((l) => l.enMano > 0)
    .sort((a, b) => a.product.localeCompare(b.product));
  const tot = sellerTotals(lines);
  const acct = sellerAccount(snap, seller.id, lines);
  const pendientes = pendingCorteItems(snap, seller.id, states).map((p) => ({
    productId: p.productId,
    product: p.product,
    cantidad: p.cantidad,
    precio: p.precio,
    monto: p.cantidad * p.precio,
  }));
  const s = await getSettings();
  const byProduct = new Map(snap.products.map((p) => [p.id, p.nombre]));
  const assignSeller = new Map(snap.assignments.map((a) => [a.id, a.seller_id]));

  return (
    <CurrencyProvider symbol={s.moneda_simbolo} code={s.moneda_codigo}>
      <VendorPortal
        token={token}
        nombre={seller.nombre}
        telefono={seller.telefono}
        lines={lines.map((l) => ({
          productId: l.productId,
          product: l.product,
          enMano: l.enMano,
          precio: l.precio,
        }))}
        pendientes={pendientes}
        historial={snap.sales
          .filter((v) => assignSeller.get(v.assignment_id) === seller.id)
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))
          .map((v) => {
            const ls = states.get(`${v.assignment_id}|${v.product_id}`);
            return {
              id: v.id,
              fecha: v.fecha,
              producto: byProduct.get(v.product_id) ?? "?",
              cantidad: v.cantidad,
              monto: v.cantidad * (ls?.precio ?? 0),
              cortada: v.corte_id !== null,
            };
          })}
        pagos={snap.payments
          .filter((p) => p.seller_id === seller.id)
          .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))
          .map((p) => ({ id: p.id, fecha: p.fecha, monto: p.monto, nota: p.nota }))}
        cuenta={{
          enMano: tot.enMano,
          unidadesVendidas: tot.unidadesVendidas,
          debe: acct.debe,
          vendidoMonto: tot.vendidoMonto,
        }}
      />
    </CurrencyProvider>
  );
}
