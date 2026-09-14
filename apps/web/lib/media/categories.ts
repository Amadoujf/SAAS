import type { AcceptedMediaType } from "@yamacommerce/storage";
import type { MediaCategory } from "@yamacommerce/storage";

/**
 * Correspondance type détecté -> catégorie de quota — voir docs/12 §12.2, « Taille
 * maximale par image/vidéo/document ». Module pur, séparé de @yamacommerce/storage
 * (qui reste sector/plan-agnostic) car cette correspondance encode une décision
 * produit (PDF = "document") plutôt qu'un fait générique.
 */
export function categoryForType(type: AcceptedMediaType): MediaCategory {
  switch (type) {
    case "jpeg":
    case "png":
    case "webp":
    case "avif":
      return "image";
    case "mp4":
      return "video";
    case "pdf":
      return "document";
  }
}

export function mediaAssetTypeForCategory(category: MediaCategory): "IMAGE" | "VIDEO" | "DOCUMENT" {
  switch (category) {
    case "image":
      return "IMAGE";
    case "video":
      return "VIDEO";
    case "document":
      return "DOCUMENT";
  }
}
