"use client";

import { useState, type CSSProperties } from "react";

/**
 * Image des sections immersives : dimensions toujours réservées par le conteneur
 * (aucun saut de mise en page) et repli propre si le fichier ne charge pas — un
 * dégradé discret à la place, jamais une icône d'image cassée ni un bloc vide.
 */
export function ImmersiveImage({
  src,
  alt,
  className = "",
  style,
  eager = false,
  fit = "cover",
}: {
  src?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  eager?: boolean;
  fit?: "cover" | "contain";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        className={`block h-full w-full bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_70%)] ${className}`}
        style={style}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={`h-full w-full select-none ${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
      style={style}
    />
  );
}
