import { redirect } from "next/navigation";
import { requireAdmin } from "@/actions/admin";
import { CurrencyProvider } from "@/components/currency";
import { PanelShell } from "@/components/panel-shell";
import { setCurrency } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireAdmin())) redirect("/login");
  const s = await getSettings();
  setCurrency(s.moneda_simbolo, s.moneda_codigo);
  return (
    <PanelShell>
      <CurrencyProvider symbol={s.moneda_simbolo} code={s.moneda_codigo}>
        {children}
      </CurrencyProvider>
    </PanelShell>
  );
}
