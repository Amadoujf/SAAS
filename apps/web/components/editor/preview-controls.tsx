"use client";

import {
  CUSTOM_DEVICE_ID,
  DEVICE_PRESETS,
  MAX_DIMENSION_PX,
  MIN_DIMENSION_PX,
  type DeviceCategory,
  type Dimensions,
} from "@/lib/editor/device-presets";
import { ReloadIcon, RotateDeviceIcon } from "./editor-icons";

const CATEGORY_LABEL: Record<DeviceCategory, string> = {
  mobile: "Téléphone",
  tablet: "Tablette",
  desktop: "Ordinateur",
};

const ZOOM_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

/**
 * Barre de contrôle de l'aperçu — voir docs/12 §12.2, « aperçu iframe responsive » (21
 * septembre 2026) : préréglages d'appareils, dimensions personnalisées, rotation,
 * zoom, rechargement. Composant PUREMENT présentationnel (tout l'état vit dans
 * `VisualEditor`, voir lib/editor/device-presets.ts pour les fonctions pures qui le
 * font évoluer) — sector-agnostic, ne connaît que des dimensions d'écran.
 */
export function PreviewControls({
  deviceId,
  dimensions,
  zoom,
  onSelectDevice,
  onCustomDimensionsChange,
  onRotate,
  onZoomChange,
  onReload,
}: {
  deviceId: string;
  dimensions: Dimensions;
  zoom: number;
  onSelectDevice: (deviceId: string) => void;
  onCustomDimensionsChange: (dimensions: Dimensions) => void;
  onRotate: () => void;
  onZoomChange: (zoom: number) => void;
  onReload: () => void;
}) {
  const isCustom = deviceId === CUSTOM_DEVICE_ID;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Préréglage d'appareil"
        value={deviceId}
        onChange={(event) => onSelectDevice(event.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1 text-[12px] text-gray-700"
      >
        {(["mobile", "tablet", "desktop"] as const).map((category) => (
          <optgroup key={category} label={CATEGORY_LABEL[category]}>
            {DEVICE_PRESETS.filter((preset) => preset.category === category).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} ({preset.width}×{preset.height})
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM_DEVICE_ID}>Personnalisé…</option>
      </select>

      {isCustom && (
        <span className="flex items-center gap-1 text-[12px] text-gray-500">
          <input
            type="number"
            aria-label="Largeur personnalisée"
            min={MIN_DIMENSION_PX}
            max={MAX_DIMENSION_PX}
            value={dimensions.width}
            onChange={(event) =>
              onCustomDimensionsChange({ width: Number(event.target.value), height: dimensions.height })
            }
            className="w-16 rounded-md border border-gray-300 px-1.5 py-1 text-[12px]"
          />
          ×
          <input
            type="number"
            aria-label="Hauteur personnalisée"
            min={MIN_DIMENSION_PX}
            max={MAX_DIMENSION_PX}
            value={dimensions.height}
            onChange={(event) =>
              onCustomDimensionsChange({ width: dimensions.width, height: Number(event.target.value) })
            }
            className="w-16 rounded-md border border-gray-300 px-1.5 py-1 text-[12px]"
          />
          px
        </span>
      )}

      <button
        type="button"
        onClick={onRotate}
        title="Rotation portrait/paysage"
        aria-label="Rotation portrait/paysage"
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <RotateDeviceIcon className="h-4 w-4" />
      </button>

      <select
        aria-label="Zoom de l'aperçu"
        value={zoom}
        onChange={(event) => onZoomChange(Number(event.target.value))}
        className="rounded-md border border-gray-300 px-2 py-1 text-[12px] text-gray-700"
      >
        {ZOOM_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {Math.round(option * 100)}%
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onReload}
        title="Recharger l'aperçu"
        aria-label="Recharger l'aperçu"
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <ReloadIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
