import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
export default function ListingsPage() { return <><PageHeader title="Listings" description="Compare current prices, shipping costs, and stock across stores." /><EmptyState title="No listings yet" description="Add products and stores before recording your first listing." /></>; }
