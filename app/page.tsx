import Hero from "@/components/Hero";
import Features from "@/components/Features";
import CompressorSection from "@/components/CompressorSection";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <Features />
        <CompressorSection />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
