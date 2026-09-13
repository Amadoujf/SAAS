"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { BrandsParams } from "./content-types";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";

/** Marques — marquee (défilement continu) ou grid (statique). Le défilement continu
 *  est désactivé si le niveau d'animation effectif est "none" (accessibilité). */
export function BrandsSection({ variant, params }: { variant: string; params: BrandsParams }) {
  const level = useAnimationLevel();
  const isMarquee = variant === "marquee" && level !== "none";

  if (isMarquee) {
    const duration = level === "immersive" ? 18 : 28;
    return (
      <section className="overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-surface)] py-8">
        <motion.div
          className="flex w-max gap-16"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration, ease: "linear", repeat: Infinity }}
        >
          {[...params.logos, ...params.logos].map((logo, index) => (
            <div key={index} className="relative h-8 w-28 shrink-0 grayscale">
              <Image src={logo.url} alt={logo.alt ?? ""} fill className="object-contain" />
            </div>
          ))}
        </motion.div>
      </section>
    );
  }

  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10">
      <div className="mx-auto flex max-w-[var(--content-max-width)] flex-wrap items-center justify-center gap-10">
        {params.logos.map((logo, index) => (
          <div key={index} className="relative h-8 w-28 grayscale">
            <Image src={logo.url} alt={logo.alt ?? ""} fill className="object-contain" />
          </div>
        ))}
      </div>
    </section>
  );
}
