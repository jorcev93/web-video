export default function Hero() {
  return (
    <section className="flex min-h-[85vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl md:text-6xl">
          Comprime tus videos al{" "}
          <span className="text-accent-light">tamaño que necesitas</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-text-secondary sm:text-xl">
          Define el peso exacto en MB y obtén tu video comprimido en segundos.
          Sin límites, sin registro, todos los formatos.
        </p>

        <div className="mt-10">
          <a
            href="#compresor"
            className="inline-block rounded-lg bg-accent px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Comenzar ahora
          </a>
        </div>
      </div>
    </section>
  );
}
