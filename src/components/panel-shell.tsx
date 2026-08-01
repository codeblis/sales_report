"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/admin";
import { ThemeToggle } from "@/components/theme-toggle";

const ITEMS = [
  { href: "/panel", label: "Panel" },
  { href: "/panel/vendedores", label: "Vendedores" },
  { href: "/panel/ventas", label: "Ventas" },
  { href: "/panel/pagos", label: "Pagos" },
  { href: "/panel/gastos", label: "Gastos" },
  { href: "/panel/recogidas", label: "Recogidas" },
  { href: "/panel/mercancia", label: "Mercancía" },
  { href: "/panel/almacen", label: "Almacén" },
  { href: "/panel/compras", label: "Compras" },
  { href: "/panel/asignar", label: "Asignar" },
  { href: "/panel/reportes", label: "Reportes" },
  { href: "/panel/ajustes", label: "Ajustes" },
];

export function PanelShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          <div className="sigil" aria-hidden="true" />
          <div>
            <h1>Distribución · panel</h1>
            <p className="srcline">Compras · asignaciones · cortes · cobros</p>
          </div>
        </div>
        <div className="tools no-print">
          <ThemeToggle />
          <form action={logout}>
            <button className="btn" type="submit">
              <span className="ico" aria-hidden="true">
                ⏻
              </span>
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="layout">
        <aside className="rail glass">
          <div className="rail-h">Panel</div>
          <nav className="daynav rail-nav" aria-label="Secciones del panel">
            {ITEMS.map((it) => {
              const active =
                pathname === it.href || (it.href !== "/panel" && pathname.startsWith(`${it.href}/`));
              return (
                <Link
                  key={it.href}
                  className="navlink"
                  href={it.href}
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="panel">{children}</main>
      </div>
    </div>
  );
}
