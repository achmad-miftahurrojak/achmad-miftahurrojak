import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold text-primary">Jurnalis Org</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/news" className="text-muted-foreground hover:text-foreground">Berita</Link>
            <Link href="/about" className="hidden text-muted-foreground hover:text-foreground sm:block">Tentang</Link>
            <Link href="/structure" className="hidden text-muted-foreground hover:text-foreground sm:block">Struktur</Link>
            <Link href="/faq" className="hidden text-muted-foreground hover:text-foreground sm:block">FAQ</Link>
            <Link href="/login" className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              Masuk
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Jurnalis Org. Dibuat oleh tim redaksi.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/sop" className="hover:text-foreground">SOP</Link>
          <Link href="/contact" className="hover:text-foreground">Kontak</Link>
        </div>
      </footer>
    </div>
  )
}
