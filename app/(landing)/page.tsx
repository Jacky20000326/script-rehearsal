/** Landing Page — SSG，server component。 */

import type { ReactElement } from "react";
import { CallToAction } from "@/components/landing/CallToAction";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

export default function LandingPage(): ReactElement {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <SiteHeader />
      <Hero />
      <Features />
      <CallToAction />
      <SiteFooter />
    </main>
  );
}
