import AdminConsole from "@/components/admin/AdminConsole";

const TABS = ["dashboard", "telemetria", "inventario", "crm", "analitica", "config"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initial = TABS.includes(tab as Tab) ? (tab as Tab) : "dashboard";
  return <AdminConsole initialTab={initial} />;
}
