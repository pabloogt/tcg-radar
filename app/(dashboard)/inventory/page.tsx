import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
export default function InventoryPage() { return <><PageHeader title="Inventory" description="Track sealed holdings, acquisition costs, and completed sales." /><EmptyState title="Your inventory is empty" description="Recorded purchases and sales will appear here." /></>; }
