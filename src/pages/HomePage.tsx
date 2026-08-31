import { Hero } from "../components/Hero";
import { Stats } from "../components/Stats";
import { Singles } from "../components/Singles";
import { About } from "../components/About";
import { NavGrid } from "../components/NavGrid";
import { CTA } from "../components/CTA";

export function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <NavGrid />
      <About />
      <Singles />
      <CTA />
    </>
  );
}
