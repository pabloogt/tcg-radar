import { createStore } from "@/app/(dashboard)/stores/actions";
import { PageHeader } from "@/components/page-header";
import { StoreForm } from "@/components/stores/store-form";
export default function NewStorePage() { return <><PageHeader title="Nueva tienda" description="Añade una tienda o marketplace para monitorizar." /><StoreForm action={createStore} /></>; }
