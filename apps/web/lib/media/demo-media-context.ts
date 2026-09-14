import "server-only";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { LocalStorageProvider, quotaConfigFromMB } from "@yamacommerce/storage";
import { InMemoryMediaRepository } from "./in-memory-media-repository";
import type { UploadPipelineDeps } from "./upload-pipeline";
import type { PageForMediaScan } from "@/lib/editor/media-references";

/**
 * Contexte de démonstration de la médiathèque — voir docs/12 §12.2, « médiathèque
 * R2 » (21 septembre 2026). Fonctionne ENTIÈREMENT sans PostgreSQL ni compte
 * Cloudflare réel, comme tous les autres `/demo/*` de ce projet : stockage sur
 * disque local (`.local-storage-demo/`, séparé du répertoire utilisé par un vrai
 * développement local — voir storage-config.ts) et métadonnées en mémoire de
 * processus (voir InMemoryMediaRepository — perdu à chaque redémarrage du serveur de
 * développement, ce qui est acceptable ici).
 *
 * Stocké sur `globalThis`, PAS comme simple constante de module — voir « Bug corrigé
 * le 21 septembre 2026 » : Next.js (App Router, mode développement) compile CHAQUE
 * route handler comme son propre bundle webpack séparé ; une simple
 * `const x = new InMemoryMediaRepository()` au niveau module donnerait alors une
 * instance DIFFÉRENTE à `request-upload/route.ts` et à `complete-upload/route.ts`,
 * bien qu'ils importent "le même" module — le média créé par le premier serait
 * introuvable pour le second. `globalThis` est la seule chose garantie partagée par
 * TOUS les bundles d'un même processus Node — c'est le même correctif que celui bien
 * connu pour `PrismaClient` en développement Next.js.
 */
export const DEMO_TENANT_ID = "demo-tenant-mediatheque";
export const DEMO_OWNER_ID = "demo-owner-mediatheque";

interface DemoMediaGlobalState {
  storage: LocalStorageProvider;
  repository: InMemoryMediaRepository;
  seeded: Promise<void> | null;
  seededAssetId: string;
  usagePages: PageForMediaScan[];
}

const globalForDemoMedia = globalThis as typeof globalThis & {
  __yamacommerceDemoMedia?: DemoMediaGlobalState;
};

function createInitialUsagePages(): PageForMediaScan[] {
  return [
    {
      id: "accueil",
      slug: "accueil",
      title: "Accueil",
      blocks: [
        {
          id: "hero-1",
          sectionKey: "hero",
          variant: "split",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: { title: "Bienvenue", media: { url: "", alt: "" } },
        },
      ],
    },
    {
      id: "a-propos",
      slug: "a-propos",
      title: "À propos",
      blocks: [
        {
          id: "manifesto-1",
          sectionKey: "brand_manifesto",
          variant: "image-left",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: { statement: "Notre histoire", media: { url: "", alt: "" } },
        },
      ],
    },
  ];
}

const state: DemoMediaGlobalState =
  globalForDemoMedia.__yamacommerceDemoMedia ??
  (globalForDemoMedia.__yamacommerceDemoMedia = {
    storage: new LocalStorageProvider({
      rootDir: path.join(process.cwd(), ".local-storage-demo"),
      uploadBaseUrl: "/api/demo-media/local-upload",
      downloadBaseUrl: "/api/demo-media/local-serve",
      signingSecret: "demo-only-insecure-secret",
    }),
    repository: new InMemoryMediaRepository(),
    seeded: null,
    seededAssetId: "",
    usagePages: createInitialUsagePages(),
  });

export const demoLocalStorageProvider = state.storage;

/** Limites de la formule "Essentiel" — voir Plan (packages/database/prisma/schema.prisma)
 *  et seed.ts, reproduites ici en dur car la démonstration n'a pas de vraie base pour
 *  les lire (voir la même convention que toutes les données `/demo/*`). */
export const DEMO_QUOTA = quotaConfigFromMB({
  storageMB: 2_048,
  maxImageFileMB: 10,
  maxVideoFileMB: 200,
  maxDocumentFileMB: 10,
  maxMediaFileCount: 2_000,
  monthlyUploadMB: 2_048,
});

export function demoMediaDeps(): UploadPipelineDeps {
  return { repository: state.repository, storage: state.storage, quotaConfig: DEMO_QUOTA };
}

export function demoMediaRepositoryInstance(): InMemoryMediaRepository {
  return state.repository;
}

/** Pages factices utilisées UNIQUEMENT pour démontrer la détection d'usage avant
 *  suppression (voir media-references.ts) — pas les vraies pages de la démonstration
 *  de l'éditeur visuel (qui reste 100% côté client, voir la note ci-dessus). */
export function demoUsagePages(): PageForMediaScan[] {
  return state.usagePages;
}

/**
 * Amorce un média déjà "importé" et déjà RÉFÉRENCÉ par une section factice (voir
 * `demoUsagePages`) — permet de démontrer honnêtement « avant suppression, afficher
 * les pages et sections qui l'utilisent » sur un média réellement utilisé, sans
 * dépendre d'un vrai brouillon d'éditeur persistant côté serveur.
 */
export function ensureDemoMediaSeeded(baseUrl: string): Promise<void> {
  if (!state.seeded) state.seeded = seedDemoMedia(baseUrl);
  return state.seeded;
}

async function seedDemoMedia(baseUrl: string): Promise<void> {
  // Écrit un VRAI fichier (voir sharp) — un média amorcé sans octets réels derrière sa
  // `storageKey` ferait échouer `/api/demo-media/[id]/file` (404/500) dès qu'on essaie
  // de l'afficher, exactement comme un média authentiquement importé le ferait pour un
  // fichier absent : la démonstration doit rester honnête, pas seulement des lignes de
  // métadonnées sans contenu réel derrière.
  const bytes = await sharp({
    create: { width: 1920, height: 1080, channels: 3, background: { r: 196, g: 154, b: 108 } },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  const upload = await demoLocalStorageProvider.createUpload({
    tenantId: DEMO_TENANT_ID,
    keySegments: ["originals", `${randomUUID()}-hero-collection.jpg`],
    contentType: "image/jpeg",
  });
  const token = new URL(upload.uploadUrl, "http://localhost").searchParams.get("token")!;
  await demoLocalStorageProvider.writeUploadedBytes(token, bytes);

  const asset = await state.repository.createPending(DEMO_TENANT_ID, {
    ownerId: DEMO_OWNER_ID,
    originalName: "hero-collection.jpg",
    storageKey: upload.storageKey,
    type: "IMAGE",
    mimeType: "image/jpeg",
    sizeBytes: bytes.length,
    folder: "accueil",
  });
  await state.repository.markReady(DEMO_TENANT_ID, asset.id, {
    sizeBytes: bytes.length,
    mimeType: "image/jpeg",
    width: 1920,
    height: 1080,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
  });

  const ref = demoAssetPublicRef(baseUrl, asset.id);
  state.usagePages[0]!.blocks[0]!.params = {
    ...state.usagePages[0]!.blocks[0]!.params,
    media: { url: ref, alt: "Photo d'ambiance de la collection" },
  };
  state.usagePages[1]!.blocks[0]!.params = {
    ...state.usagePages[1]!.blocks[0]!.params,
    media: { url: ref, alt: "Photo d'ambiance de la collection" },
  };
  state.seededAssetId = asset.id;
}

export function demoSeededMediaAssetId(): string {
  return state.seededAssetId;
}

/**
 * URL PUBLIQUE stable d'un média de démonstration — un chemin applicatif opaque
 * (JAMAIS une clé de stockage réelle, voir « les clés R2 ne doivent jamais être
 * envoyées au navigateur »), résolue par `app/api/demo-media/[id]/file/route.ts`.
 * Utilisée à la fois comme `<img src>` (médiathèque, sections factices) ET comme
 * valeur choisie par le sélecteur de médias de l'éditeur.
 *
 * TOUJOURS absolue (`baseUrl` requis, jamais un chemin nu) — voir le bug corrigé le
 * 21 septembre 2026 : les schémas de section (`mediaSchema`, @yamacommerce/templates)
 * valident `url` avec `z.string().url()`, qui REFUSE un chemin relatif comme
 * "/api/...". Un média choisi depuis la médiathèque doit rester une URL valide au
 * sens de ce schéma générique — commun à toutes les sections/secteurs, jamais changé
 * pour cette seule intégration. `baseUrl` vient TOUJOURS de `request.nextUrl.origin`
 * côté appelant (jamais d'une variable d'environnement devinée) : fiable quel que
 * soit le port du serveur de développement.
 */
export function demoAssetPublicRef(baseUrl: string, mediaAssetId: string): string {
  return `${baseUrl}/api/demo-media/${mediaAssetId}/file`;
}
