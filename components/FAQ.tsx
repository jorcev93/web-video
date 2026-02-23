"use client";

import { useState } from "react";

const faqs = [
  {
    question: "¿Qué formatos de video son compatibles?",
    answer:
      "Soportamos todos los formatos que FFmpeg puede procesar: MP4, WebM, MOV, AVI, MKV, FLV, WMV, y muchos más. Si tu reproductor puede abrirlo, probablemente nosotros podemos comprimirlo.",
  },
  {
    question: "¿Hay un límite de tamaño para subir videos?",
    answer:
      "No imponemos un límite artificial de tamaño. Sin embargo, ten en cuenta que videos muy grandes tomarán más tiempo en subirse y procesarse dependiendo de tu conexión a internet.",
  },
  {
    question: "¿Mis videos son privados?",
    answer:
      "Sí. Tus videos se procesan en el servidor y se eliminan automáticamente después de que los descargas. No almacenamos ni compartimos tu contenido con terceros.",
  },
  {
    question: "¿Se pierde mucha calidad al comprimir?",
    answer:
      "La calidad depende del tamaño objetivo que elijas. Mientras más cercano al tamaño original, mejor calidad. El compresor calcula automáticamente el mejor bitrate posible para el tamaño que especifiques.",
  },
  {
    question: "¿En qué formato se entrega el video comprimido?",
    answer:
      "El video comprimido se entrega en formato MP4 con codec H.264, que es el formato más compatible con navegadores, dispositivos móviles y redes sociales.",
  },
  {
    question: "¿Necesito crear una cuenta para comprimir videos?",
    answer:
      "No. El compresor funciona sin necesidad de registro. La cuenta es opcional y solo sirve para guardar un historial de tus compresiones previas.",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={`size-5 shrink-0 text-text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m19.5 8.25-7.5 7.5-7.5-7.5"
      />
    </svg>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex(openIndex === index ? null : index);
  }

  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
          Preguntas frecuentes
        </h2>

        <div className="divide-y divide-border rounded-xl border border-border bg-surface">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index}>
                <button
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-hover"
                >
                  <span className="text-base font-medium text-text-primary">
                    {faq.question}
                  </span>
                  <ChevronIcon open={isOpen} />
                </button>
                <div
                  className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm leading-relaxed text-text-secondary">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
