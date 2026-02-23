export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-text-muted">
            &copy; {new Date().getFullYear()} VideoCompress. Todos los derechos reservados.
          </p>
          <nav className="flex gap-6">
            <a
              href="#"
              className="text-sm text-text-muted transition-colors hover:text-text-secondary"
            >
              Privacidad
            </a>
            <a
              href="#"
              className="text-sm text-text-muted transition-colors hover:text-text-secondary"
            >
              Contacto
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
