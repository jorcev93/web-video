import Hero from "@/components/Hero";
import Features from "@/components/Features";
import ToolSection from "@/components/ToolSection";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <Features />
        <ToolSection />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
