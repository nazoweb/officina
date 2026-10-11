import Link from "next/link";
export default function NotFound() { return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-2xl font-semibold">Pagina non trovata</h1><p>Il collegamento potrebbe essere incompleto oppure la pagina è stata spostata. Torna al magazzino per continuare.</p><Link className="underline" href="/codici/magazzino">Apri magazzino</Link></main>; }
