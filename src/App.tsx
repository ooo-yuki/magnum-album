import { Hero } from "./components/Hero";
import { Stats } from "./components/Stats";
import { Singles } from "./components/Singles";
import { CTA } from "./components/CTA";
import { Particles } from "./components/Particles";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <Particles />
      <Hero />
      <Stats />
      <Singles />
      <CTA />
      <Footer />
    </>
  );
}
