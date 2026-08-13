import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/products/product-form";
import { createProduct } from "@/app/(dashboard)/products/actions";
export default function NewProductPage() { return <><PageHeader title="Nuevo producto" description="Añade un producto sellado a tu watchlist." /><ProductForm action={createProduct} /></>; }
