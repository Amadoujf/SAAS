"use client";

import { motion } from "framer-motion";
import { useAnimationLevel } from "./animation-level-context";

/**
 * Révèle un texte mot par mot au défilement — voir la refonte artistique du 16
 * septembre 2026 (« apparition progressive des mots », « texte révélé ligne par
 * ligne »). Chaque mot est un `<span>` indépendant animé en cascade ; au niveau
 * "none"/"discreet" (ou `prefers-reduced-motion`), le texte apparaît directement,
 * sans cascade, pour ne pas retarder la lecture.
 */
export function RevealText({
  text,
  as: Tag = "p",
  className,
  wordClassName,
}: {
  text: string;
  as?: "p" | "h1" | "h2" | "h3" | "span";
  className?: string;
  wordClassName?: string;
}) {
  const level = useAnimationLevel();
  const words = text.split(" ");
  const animated = level !== "none" && level !== "discreet";

  if (!animated) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, index) => (
        <span key={index} className="inline-block overflow-hidden" aria-hidden="true">
          <motion.span
            className={`inline-block ${wordClassName ?? ""}`}
            initial={{ transform: "translateY(100%)", opacity: 0 }}
            whileInView={{ transform: "translateY(0%)", opacity: 1 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{
              duration: 0.6,
              ease: [0.4, 0, 0.2, 1],
              delay: index * 0.045,
            }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
