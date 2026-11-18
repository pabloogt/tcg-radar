import { PageHeader } from "@/components/page-header";
import { SetForm } from "@/components/investment/set-form";
import { createSet } from "../../actions";
export default function NewSetPage() { return <><PageHeader title="Nueva colección" description="Crea la identidad normalizada de un set TCG." /><SetForm action={createSet} /></>; }
