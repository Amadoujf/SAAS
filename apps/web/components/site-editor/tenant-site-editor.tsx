"use client";

import Link from "next/link";
import type { AnimationLevel, DesignTokens } from "@yamacommerce/design-tokens";
import type { SectionInstance } from "@yamacommerce/templates";
import { VisualEditor } from "@/components/editor/visual-editor";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";
import type { EditorContent } from "@/lib/editor/editor-reducer";
import type { EditorIdOptions } from "@/lib/editor/id-options-context";
import { createEmptySiteSettings } from "@/lib/editor/site-settings";

async function post(action: "save" | "publish", content: EditorContent) {
  const res = await fetch("/api/site-editor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, pages: content.pages.map((p) => ({ id: p.id, blocks: p.blocks })) }),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { versionNumber?: number | null }; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Action impossible.");
  return json.data;
}

/** Éditeur visuel RÉEL d'une entreprise : son brouillon, ses contenus, sa médiathèque ;
 *  « Publier » enregistre puis publie par le pipeline atomique. */
export function TenantSiteEditor(props: {
  tenantName: string;
  storeUrl: string | null;
  sectorKey: string | null;
  pages: { id: string; slug: string; title: string; isHome: boolean; blocks: SectionInstance[] }[];
  tokens: DesignTokens;
  animationLevel: AnimationLevel;
  resolvedContent: ResolvedContentBySectionId;
  idOptions: EditorIdOptions;
  canPublish: boolean;
}) {
  const initialContent: EditorContent = {
    selectedPageId: props.pages[0]!.id,
    selectedSectionId: null,
    siteSettings: createEmptySiteSettings(),
    pages: props.pages,
  };
  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-2 text-[13px]">
        <Link href="/dashboard" className="font-medium text-gray-600 hover:text-gray-900">← Tableau de bord</Link>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-900">{props.tenantName}</span>
        <span className="text-gray-500">Le site en ligne ne change qu&apos;à la publication.</span>
        {props.storeUrl && <a href={props.storeUrl} target="_blank" rel="noreferrer" className="ml-auto font-medium text-indigo-700 hover:underline">Voir le site en ligne ↗</a>}
      </div>
      <div className="min-h-0 flex-1">
        <VisualEditor
          initialContent={initialContent}
          tokens={props.tokens}
          animationLevel={props.animationLevel}
          resolvedContent={props.resolvedContent}
          previewSrc="/editeur/apercu"
          mediaApiBase="/api/media"
          sectorKey={props.sectorKey}
          idOptions={props.idOptions}
          onSaveDraft={async (content) => {
            await post("save", content);
          }}
          onPublish={
            props.canPublish
              ? async (content) => {
                  const data = await post("publish", content);
                  return `Site publié${data?.versionNumber ? ` (version ${data.versionNumber})` : ""}. Il est en ligne.`;
                }
              : async () => {
                  throw new Error("Seuls le propriétaire et les gérants peuvent publier. Enregistrez le brouillon : ils pourront le publier.");
                }
          }
        />
      </div>
    </div>
  );
}
