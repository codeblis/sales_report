import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="shell">
      <header className="masthead">
        <div className="brand">
          <div className="sigil" aria-hidden="true" />
          <div>
            <h1>Distribución · ventas e inventario</h1>
            <p className="srcline">Compras · asignaciones · cortes · cobros</p>
          </div>
        </div>
        <div className="tools no-print">
          <ThemeToggle />
          <Link className="btn btn-solid" href="/login">
            Entrar al panel
          </Link>
        </div>
      </header>

      <main>
        <section className="glass empty enter">
          <div className="eyebrow">Panel del distribuidor</div>
          <h2>
            Compra, asigna a tus vendedores
            <br />y liquida con cortes de venta.
          </h2>
          <p>
            La mercancía se entrega en mano y cada vendedor reporta sus ventas con un enlace propio. Tú
            decides cuándo cortar, cobrar, recoger o traspasar — todo queda en un solo panel, con reportes
            exportables a PDF y Excel.
          </p>
          <div className="cta flex justify-center gap-3 flex-wrap">
            <Link className="btn btn-solid" href="/login">
              Entrar al panel
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
