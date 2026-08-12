import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return <><PageHeader title="Dashboard" description="Your sealed-product watchlist, opportunities, and inventory at a glance." /><EmptyState title="Your dashboard is ready" description="Add products and listings to start building your private market overview." action={{ label: "Go to products", href: "/products" }} /></>;
}
