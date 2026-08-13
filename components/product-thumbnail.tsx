export function ProductThumbnail({ imageUrl, name, size = "sm" }: { imageUrl: string | null; name: string; size?: "sm" | "lg" }) {
  const dimensions = size === "lg" ? "size-24" : "size-10";
  if (imageUrl) return <span role="img" aria-label={`Imagen de ${name}`} className={`${dimensions} shrink-0 rounded-lg border bg-slate-100 bg-cover bg-center`} style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }} />;
  return <span aria-label="Sin imagen" role="img" className={`grid ${dimensions} shrink-0 place-items-center rounded-lg border bg-slate-100 text-slate-400`}><svg aria-hidden="true" className={size === "lg" ? "size-8" : "size-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m3 17 5-5 4 4 3-3 6 6" /></svg></span>;
}
