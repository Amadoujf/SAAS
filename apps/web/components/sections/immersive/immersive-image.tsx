"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

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
  const ref = useRef<HTMLImageElement>(null);
  // Une image en échec AVANT l'hydratation de la page ne redéclenche pas `onError` :
  // son état est donc vérifié au montage (chargement terminé mais sans pixels).
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
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
      ref={ref}
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
