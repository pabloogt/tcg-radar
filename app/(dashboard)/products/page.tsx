import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
export default function ProductsPage() { return <><PageHeader title="Products" description="Manage the sealed TCG products you want to follow." /><EmptyState title="No products yet" description="Products you add to your watchlist will appear here." /></>; }
