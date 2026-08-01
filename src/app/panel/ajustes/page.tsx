import { MonedaForm, PinFormAdmin } from "@/components/ajustes-forms";
import { BackupRestore } from "@/components/backup-restore";
import { loadSnapshot } from "@/lib/repo";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const [snap, settings] = await Promise.all([loadSnapshot(), getSettings()]);
  const backup = JSON.stringify(snap);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Moneda</h3>
            <div className="sub">Se aplica a todos los montos del sistema</div>
          </div>
        </div>
        <div className="mt-4">
          <MonedaForm simbolo={settings.moneda_simbolo} codigo={settings.moneda_codigo} />
        </div>
      </section>

      <section className="glass card">
        <div className="card-h">
          <div>
            <h3>Cambiar PIN de administrador</h3>
            <div className="sub">Necesitas tu PIN actual para cambiarlo</div>
          </div>
        </div>
        <div className="mt-4">
          <PinFormAdmin />
        </div>
      </section>

      <section className="glass card" style={{ gridColumn: "1 / -1" }}>
        <div className="card-h">
          <div>
            <h3>Respaldo y restauración</h3>
            <div className="sub">Descarga una copia completa o restaura una existente</div>
          </div>
        </div>
        <div className="mt-4">
          <BackupRestore backup={backup} />
        </div>
      </section>
    </div>
  );
}
