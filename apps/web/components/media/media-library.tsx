"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { uploadMediaFile, UploadRequestError } from "@/lib/media/upload-client";
import { CropModal } from "./crop-modal";

/**
 * Médiathèque — voir docs/12 §12.2, « médiathèque R2 » (21 septembre 2026), section
 * INTERFACE. Composant SECTOR-AGNOSTIC (aucune donnée e-commerce codée en dur) et
 * RÉUTILISABLE : la même implémentation sert la démonstration autonome
 * (`/demo/mediatheque`, `apiBase="/api/demo-media"`) ET le sélecteur de médias intégré
 * à l'éditeur visuel (voir schema-form.tsx) — seul `apiBase` change, et `onSelect`
 * bascule vers un mode sélection au lieu du plein écran de gestion.
 *
 * Limites assumées (voir le rapport de livraison) : « Remplacer » et « Dupliquer »
 * créent un NOUVEAU média (l'ancien est déplacé en corbeille pour "Remplacer") plutôt
 * que de muter les octets d'un média existant en conservant son identifiant — toute
 * section qui référence l'ancien identifiant doit être mise à jour manuellement.
 * « Reprise après échec » relance l'import depuis le début (pas un vrai upload
 * reprenable par plage d'octets).
 */

interface MediaVariant {
  key: string;
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
}

interface MediaAsset {
  id: string;
  originalName: string;
  url: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  folder: string;
  status: "READY" | "TRASHED";
  referenceCount: number;
  variants: MediaVariant[];
  importedAt: string;
}

interface QuotaSummary {
  storageUsedRatio: number;
  monthlyUsedRatio: number;
  fileCountUsedRatio: number;
  level: "ok" | "warning" | "exceeded";
}

interface UsageLocation {
  pageTitle: string;
  sectionKey: string;
  fieldPaths: string[];
}

interface UploadTask {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "failed";
  message?: string;
  controller: AbortController;
}

export interface SelectedMedia {
  id: string;
  url: string;
  altText: string | null;
  originalName: string;
}

export interface MediaLibraryProps {
  apiBase: string;
  onSelect?: (asset: SelectedMedia) => void;
  onClose?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

let uploadTaskCounter = 0;

export function MediaLibrary({ apiBase, onSelect, onClose }: MediaLibraryProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "IMAGE" | "VIDEO" | "DOCUMENT">("");
  const [folderFilter, setFolderFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [quota, setQuota] = useState<QuotaSummary | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [cropping, setCropping] = useState<MediaAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ asset: MediaAsset; usage: UsageLocation[] } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<MediaAsset | null>(null);

  const loadAssets = useCallback(async () => {
    const params = new URLSearchParams({ status: showTrash ? "TRASHED" : "READY" });
    if (typeFilter) params.set("type", typeFilter);
    if (folderFilter) params.set("folder", folderFilter);
    if (search) params.set("search", search);
    const response = await fetch(`${apiBase}?${params.toString()}`);
    const data = await response.json();
    setAssets(data.items ?? []);
  }, [apiBase, showTrash, typeFilter, folderFilter, search]);

  const loadQuota = useCallback(async () => {
    const response = await fetch(`${apiBase}/usage`);
    const data = await response.json();
    setQuota(data.summary ?? null);
  }, [apiBase]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  const folders = useMemo(
    () => [...new Set(assets.map((asset) => asset.folder).filter(Boolean))],
    [assets],
  );

  const sortedAssets = useMemo(() => {
    const copy = [...assets];
    if (sortBy === "name") copy.sort((a, b) => a.originalName.localeCompare(b.originalName));
    else if (sortBy === "size") copy.sort((a, b) => b.sizeBytes - a.sizeBytes);
    else copy.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
    return copy;
  }, [assets, sortBy]);

  async function startUploads(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const taskId = `upload-${++uploadTaskCounter}`;
      const controller = new AbortController();
      setUploads((prev) => [...prev, { id: taskId, file, progress: 0, status: "uploading", controller }]);
      runUpload(taskId, file, controller);
    }
  }

  async function runUpload(taskId: string, file: File, controller: AbortController) {
    try {
      const outcome = await uploadMediaFile(apiBase, file, {
        folder: folderFilter || undefined,
        signal: controller.signal,
        onProgress: (percent) =>
          setUploads((prev) => prev.map((task) => (task.id === taskId ? { ...task, progress: percent } : task))),
      });
      if (outcome.status === "ready") {
        setUploads((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: "done", progress: 100 } : task)));
        loadAssets();
        loadQuota();
      } else {
        setUploads((prev) =>
          prev.map((task) => (task.id === taskId ? { ...task, status: "failed", message: outcome.message } : task)),
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setUploads((prev) => prev.filter((task) => task.id !== taskId));
        return;
      }
      const message = error instanceof UploadRequestError ? error.message : "Échec de l'import.";
      setUploads((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: "failed", message } : task)));
    }
  }

  function retryUpload(task: UploadTask) {
    setUploads((prev) => prev.filter((t) => t.id !== task.id));
    startUploads([task.file]);
  }

  function cancelUpload(task: UploadTask) {
    task.controller.abort();
  }

  async function requestDelete(asset: MediaAsset) {
    const response = await fetch(`${apiBase}/${asset.id}/usage`);
    const data = await response.json();
    setDeleteTarget({ asset, usage: data.usage ?? [] });
  }

  async function confirmTrash() {
    if (!deleteTarget) return;
    await fetch(`${apiBase}/${deleteTarget.asset.id}/trash`, { method: "POST" });
    setDeleteTarget(null);
    loadAssets();
    loadQuota();
  }

  async function restoreAsset(asset: MediaAsset) {
    await fetch(`${apiBase}/${asset.id}/restore`, { method: "POST" });
    loadAssets();
    loadQuota();
  }

  async function permanentlyDelete(asset: MediaAsset) {
    if (!window.confirm(`Supprimer définitivement « ${asset.originalName} » ? Cette action est irréversible.`)) return;
    await fetch(`${apiBase}/${asset.id}/permanent`, { method: "DELETE" });
    loadAssets();
    loadQuota();
  }

  async function saveEdit(input: { originalName: string; altText: string; caption: string; folder: string }) {
    if (!editing) return;
    await fetch(`${apiBase}/${editing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    setEditing(null);
    loadAssets();
  }

  async function duplicateAsset(asset: MediaAsset) {
    const response = await fetch(asset.url);
    const blob = await response.blob();
    const file = new File([blob], `copie-${asset.originalName}`, { type: asset.mimeType });
    startUploads([file]);
  }

  function downloadAsset(asset: MediaAsset) {
    const link = document.createElement("a");
    link.href = asset.url;
    link.download = asset.originalName;
    link.click();
  }

  async function handleCropApplied(blob: Blob) {
    if (!cropping) return;
    const file = new File([blob], `recadre-${cropping.originalName.replace(/\.[^.]+$/, "")}.jpg`, {
      type: "image/jpeg",
    });
    setCropping(null);
    startUploads([file]);
  }

  async function handleReplaceFile(file: File) {
    const target = replaceTargetRef.current;
    if (!target) return;
    await fetch(`${apiBase}/${target.id}/trash`, { method: "POST" });
    startUploads([file]);
  }

  return (
    <div
      className="flex h-full flex-col bg-white"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingOver(false);
        if (event.dataTransfer.files.length > 0) startUploads(event.dataTransfer.files);
      }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3">
        <p className="text-[13px] font-semibold text-gray-800">Médiathèque</p>
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-48 rounded-md border border-gray-300 px-2.5 py-1 text-[12px]"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
          className="rounded-md border border-gray-300 px-2 py-1 text-[12px]"
        >
          <option value="">Tous les types</option>
          <option value="IMAGE">Images</option>
          <option value="VIDEO">Vidéos</option>
          <option value="DOCUMENT">Documents</option>
        </select>
        <select
          value={folderFilter}
          onChange={(event) => setFolderFilter(event.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-[12px]"
        >
          <option value="">Tous les dossiers</option>
          {folders.map((folder) => (
            <option key={folder} value={folder}>
              {folder}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
          className="rounded-md border border-gray-300 px-2 py-1 text-[12px]"
        >
          <option value="date">Plus récent</option>
          <option value="name">Nom</option>
          <option value="size">Taille</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTrash((v) => !v)}
            aria-pressed={showTrash}
            className={`rounded-md border px-2.5 py-1 text-[12px] font-medium ${
              showTrash ? "border-red-300 bg-red-50 text-red-700" : "border-gray-300 text-gray-700"
            }`}
          >
            Corbeille
          </button>
          <div className="flex items-center overflow-hidden rounded-md border border-gray-300">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={`px-2 py-1 text-[12px] ${view === "grid" ? "bg-indigo-600 text-white" : "text-gray-600"}`}
            >
              Grille
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`px-2 py-1 text-[12px] ${view === "list" ? "bg-indigo-600 text-white" : "text-gray-600"}`}
            >
              Liste
            </button>
          </div>
          {!showTrash && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-indigo-700"
            >
              Importer des fichiers
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,video/mp4"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) startUploads(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,video/mp4"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleReplaceFile(file);
              event.target.value = "";
            }}
          />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la médiathèque"
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {quota && (
        <div className="border-b border-gray-200 px-4 py-2">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>Espace utilisé</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full ${
                  quota.level === "exceeded" ? "bg-red-500" : quota.level === "warning" ? "bg-amber-500" : "bg-indigo-500"
                }`}
                style={{ width: `${Math.min(100, quota.storageUsedRatio * 100)}%` }}
              />
            </div>
            <span>{Math.round(quota.storageUsedRatio * 100)}%</span>
            {quota.level === "warning" && <span className="text-amber-600">Quota bientôt atteint (80%)</span>}
            {quota.level === "exceeded" && <span className="text-red-600">Quota atteint — import bloqué</span>}
          </div>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="flex flex-col gap-1.5 border-b border-gray-200 bg-gray-50 px-4 py-2">
          {uploads.map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-[11px]">
              <span className="w-40 truncate text-gray-700">{task.file.name}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full ${task.status === "failed" ? "bg-red-500" : "bg-indigo-500"}`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              {task.status === "uploading" && (
                <button type="button" onClick={() => cancelUpload(task)} className="text-gray-400 hover:text-gray-700">
                  Annuler
                </button>
              )}
              {task.status === "failed" && (
                <>
                  <span className="text-red-600">{task.message}</span>
                  <button type="button" onClick={() => retryUpload(task)} className="font-medium text-indigo-600">
                    Réessayer
                  </button>
                </>
              )}
              {task.status === "done" && <span className="text-emerald-600">Importé ✓</span>}
            </div>
          ))}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-y-auto p-4">
        {isDraggingOver && (
          <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/80 text-[13px] font-medium text-indigo-600">
            Déposer pour importer
          </div>
        )}

        {sortedAssets.length === 0 && (
          <p className="py-12 text-center text-[12px] text-gray-400">
            {showTrash ? "La corbeille est vide." : "Aucun média. Importez votre premier fichier."}
          </p>
        )}

        {view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sortedAssets.map((asset) => (
              <div key={asset.id} className="group relative rounded-lg border border-gray-200 p-2">
                <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded bg-gray-100">
                  {asset.type === "IMAGE" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt={asset.altText ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[11px] uppercase text-gray-400">{asset.type}</span>
                  )}
                  {asset.referenceCount > 0 && (
                    <span className="absolute left-3 top-3 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                      utilisé × {asset.referenceCount}
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] font-medium text-gray-700">{asset.originalName}</p>
                <p className="text-[10px] text-gray-400">{formatBytes(asset.sizeBytes)}</p>

                {onSelect ? (
                  <button
                    type="button"
                    onClick={() =>
                      onSelect({ id: asset.id, url: asset.url, altText: asset.altText, originalName: asset.originalName })
                    }
                    className="mt-1 w-full rounded-md bg-indigo-600 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                  >
                    Choisir
                  </button>
                ) : showTrash ? (
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => restoreAsset(asset)}
                      className="flex-1 rounded-md border border-gray-300 py-1 text-[11px] hover:border-gray-400"
                    >
                      Restaurer
                    </button>
                    <button
                      type="button"
                      onClick={() => permanentlyDelete(asset)}
                      className="flex-1 rounded-md border border-red-300 py-1 text-[11px] text-red-600 hover:bg-red-50"
                    >
                      Supprimer déf.
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 grid grid-cols-3 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" title="Modifier" onClick={() => setEditing(asset)} className="rounded border border-gray-200 py-1 text-[10px]">
                      Modifier
                    </button>
                    {asset.type === "IMAGE" && (
                      <button type="button" title="Recadrer" onClick={() => setCropping(asset)} className="rounded border border-gray-200 py-1 text-[10px]">
                        Recadrer
                      </button>
                    )}
                    <button
                      type="button"
                      title="Remplacer"
                      onClick={() => {
                        replaceTargetRef.current = asset;
                        replaceInputRef.current?.click();
                      }}
                      className="rounded border border-gray-200 py-1 text-[10px]"
                    >
                      Remplacer
                    </button>
                    <button type="button" title="Dupliquer" onClick={() => duplicateAsset(asset)} className="rounded border border-gray-200 py-1 text-[10px]">
                      Dupliquer
                    </button>
                    <button type="button" title="Télécharger" onClick={() => downloadAsset(asset)} className="rounded border border-gray-200 py-1 text-[10px]">
                      Télécharger
                    </button>
                    <button
                      type="button"
                      title="Supprimer"
                      onClick={() => requestDelete(asset)}
                      className="rounded border border-red-200 py-1 text-[10px] text-red-600"
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-gray-200 text-[11px] uppercase text-gray-400">
                <th className="py-2">Nom</th>
                <th>Type</th>
                <th>Taille</th>
                <th>Dossier</th>
                <th>Utilisation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedAssets.map((asset) => (
                <tr key={asset.id} className="border-b border-gray-100">
                  <td className="py-2">{asset.originalName}</td>
                  <td>{asset.type}</td>
                  <td>{formatBytes(asset.sizeBytes)}</td>
                  <td>{asset.folder || "—"}</td>
                  <td>{asset.referenceCount > 0 ? `× ${asset.referenceCount}` : "—"}</td>
                  <td className="text-right">
                    {onSelect ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSelect({ id: asset.id, url: asset.url, altText: asset.altText, originalName: asset.originalName })
                        }
                        className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white"
                      >
                        Choisir
                      </button>
                    ) : showTrash ? (
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => restoreAsset(asset)} className="rounded border border-gray-300 px-2 py-1 text-[11px]">
                          Restaurer
                        </button>
                        <button type="button" onClick={() => permanentlyDelete(asset)} className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600">
                          Supprimer déf.
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setEditing(asset)} className="rounded border border-gray-200 px-2 py-1 text-[11px]">
                          Modifier
                        </button>
                        <button type="button" onClick={() => requestDelete(asset)} className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600">
                          Supprimer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <EditModal
          asset={editing}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {cropping && (
        <CropModal
          imageUrl={cropping.url}
          fileName={cropping.originalName}
          onCancel={() => setCropping(null)}
          onApply={handleCropApplied}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          asset={deleteTarget.asset}
          usage={deleteTarget.usage}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmTrash}
        />
      )}
    </div>
  );
}

function EditModal({
  asset,
  onCancel,
  onSave,
}: {
  asset: MediaAsset;
  onCancel: () => void;
  onSave: (input: { originalName: string; altText: string; caption: string; folder: string }) => void;
}) {
  const [originalName, setOriginalName] = useState(asset.originalName);
  const [altText, setAltText] = useState(asset.altText ?? "");
  const [caption, setCaption] = useState(asset.caption ?? "");
  const [folder, setFolder] = useState(asset.folder);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <p className="mb-3 text-[13px] font-semibold text-gray-800">Modifier « {asset.originalName} »</p>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px] text-gray-700">
            Nom du fichier
            <input value={originalName} onChange={(e) => setOriginalName(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-gray-700">
            Texte alternatif
            <input value={altText} onChange={(e) => setAltText(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-gray-700">
            Légende
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-[12px] text-gray-700">
            Dossier
            <input value={folder} onChange={(e) => setFolder(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px]">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSave({ originalName, altText, caption, folder })}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  asset,
  usage,
  onCancel,
  onConfirm,
}: {
  asset: MediaAsset;
  usage: UsageLocation[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <p className="mb-2 text-[13px] font-semibold text-gray-800">Supprimer « {asset.originalName} » ?</p>
        {usage.length > 0 ? (
          <>
            <p className="mb-2 text-[12px] text-red-600">
              Ce média est utilisé à {usage.length} endroit{usage.length > 1 ? "s" : ""} :
            </p>
            <ul className="mb-3 max-h-32 list-disc overflow-y-auto pl-5 text-[12px] text-gray-700">
              {usage.map((location, index) => (
                <li key={index}>
                  {location.pageTitle} — section {location.sectionKey}
                </li>
              ))}
            </ul>
            <p className="mb-3 text-[11px] text-gray-500">
              Le média sera déplacé vers la corbeille ; pensez à remplacer ces références.
            </p>
          </>
        ) : (
          <p className="mb-3 text-[12px] text-gray-500">Ce média n&apos;est utilisé nulle part.</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-gray-300 px-3 py-1.5 text-[12px]">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white">
            Déplacer vers la corbeille
          </button>
        </div>
      </div>
    </div>
  );
}
