import { redirect } from "next/navigation";
import { requireAdmin } from "@/actions/admin";
import { PinForm } from "@/components/pin-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { hasAdminPin } from "@/lib/settings";

export const metadata = { title: "Acceso" };

export default async function LoginPage() {
  if (await requireAdmin()) redirect("/panel");
  const firstRun = !(await hasAdminPin());

  return (
    <div className="shell" style={{ maxWidth: 460 }}>
      <header className="masthead">
        <div className="brand">
          <div className="sigil" aria-hidden="true" />
          <div>
            <h1>Panel del distribuidor</h1>
            <p className="srcline">{firstRun ? "Primer arranque" : "Acceso restringido"}</p>
          </div>
        </div>
        <div className="tools no-print">
          <ThemeToggle />
        </div>
      </header>

      <section className="glass card enter">
        <div className="card-h" style={{ marginBottom: 18 }}>
          <div>
            <h3>{firstRun ? "Crea el PIN de administrador" : "Entra con tu PIN"}</h3>
            <div className="sub">
              {firstRun
                ? "Solo se pide una vez; lo podrás cambiar en Ajustes."
                : "El PIN tiene entre 4 y 6 dígitos."}
            </div>
          </div>
        </div>
        <PinForm mode={firstRun ? "create" : "login"} />
      </section>
    </div>
  );
}
