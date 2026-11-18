import { PageHeader } from "@/components/page-header";
import { DealSettingsForm } from "@/components/settings/deal-settings-form";
import { requireUser } from "@/lib/auth/require-user";

const percent = (basisPoints: number) => (basisPoints / 100).toFixed(2).replace(/\.00$/, "").replace(".", ",");

export default async function PricingSettingsPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("deal_settings").select("*").eq("user_id", user.id).maybeSingle();
  return <><PageHeader title="Clasificación de precios" description="Configura cuándo un precio es bueno, una oportunidad, un chollo o caro." /><DealSettingsForm initialValues={{ goodPrice: percent(data?.good_price_bps ?? 0), opportunity: percent(data?.opportunity_bps ?? 800), bargain: percent(data?.bargain_bps ?? 1_500), expensive: percent(data?.expensive_bps ?? 1_000), alertBargains: data?.alert_bargains ?? true, alertOpportunities: data?.alert_opportunities ?? true, alertGoodPrices: data?.alert_good_prices ?? false }} /></>;
}
