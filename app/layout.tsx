import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Video Compressor - Comprime tus videos al tamaño que necesitas",
  description:
    "Comprime videos a un tamaño específico en MB. Gratis, sin límites, todos los formatos soportados.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} dark`}>
      <body className="min-h-screen bg-background text-text-primary font-sans antialiased">
        <SessionProvider>
          <Header />
          <div className="pt-14">{children}</div>
        </SessionProvider>
      </body>
    </html>
  );
}
