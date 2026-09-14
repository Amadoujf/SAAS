"use client";

import { useState } from "react";
import type { FieldDescriptor } from "@/lib/editor/schema-introspect";
import { emptyValueForField } from "@/lib/editor/schema-introspect";
import { CloseSmallIcon, ResetIcon } from "@/components/editor/editor-icons";

/**
 * Formulaire générique généré à partir d'une liste de `FieldDescriptor` (voir
 * lib/editor/schema-introspect.ts) — voir docs/12 §12.2, « Les formulaires doivent être
 * générés à partir des schémas des sections autant que possible. ». AUCUN nom de champ
 * propre à une section ou à un secteur n'apparaît dans ce fichier : il ne connaît que
 * les 10 natures de champ (`FieldKind`) et sait s'afficher pour n'importe laquelle,
 * y compris récursivement pour les objets et tableaux d'objets imbriqués — donc pour
 * n'importe quelle section e-commerce déjà livrée ET n'importe quel futur secteur.
 *
 * Limite assumée (voir le rapport de livraison) : les champs `id-list` (ex.
 * `categoryIds`) s'éditent comme une simple liste d'identifiants texte, faute d'accès
 * catalogue en direct dans cet environnement — pas un vrai sélecteur visuel de
 * produits/catégories.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldValue(container: Record<string, unknown>, field: FieldDescriptor): unknown {
  if (field.name in container) return container[field.name];
  return field.defaultValue ?? emptyValueForField(field);
}

function isCustomized(field: FieldDescriptor, current: unknown, original: unknown): boolean {
  if (original === undefined) return current !== undefined && current !== field.defaultValue;
  return JSON.stringify(current) !== JSON.stringify(original);
}

export interface SchemaFormProps {
  fields: FieldDescriptor[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Erreurs de validation par nom de champ (premier niveau) — voir field-errors.ts. */
  errors?: Record<string, string[]>;
  /** Valeurs d'origine (template) — active l'indicateur "personnalisé" + le bouton de
   *  réinitialisation par champ quand fourni. */
  originalValue?: Record<string, unknown>;
  idPrefix?: string;
}

export function SchemaForm({
  fields,
  value,
  onChange,
  errors,
  originalValue,
  idPrefix = "f",
}: SchemaFormProps) {
  function setField(name: string, next: unknown) {
    onChange({ ...value, [name]: next });
  }

  function resetField(field: FieldDescriptor) {
    if (!originalValue) return;
    const next = { ...value };
    if (field.name in originalValue) {
      next[field.name] = originalValue[field.name];
    } else {
      delete next[field.name];
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const current = fieldValue(value, field);
        const original = originalValue ? fieldValue(originalValue, field) : undefined;
        const customized = originalValue ? isCustomized(field, current, original) : false;
        const fieldErrors = errors?.[field.name];
        const inputId = `${idPrefix}-${field.name}`;

        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <label htmlFor={inputId} className="text-[12px] font-medium text-gray-700">
                {field.label}
                {field.required && <span className="ml-0.5 text-red-500">*</span>}
              </label>
              {customized && (
                <span
                  title="Personnalisé pour cette section"
                  aria-label="Personnalisé"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500"
                />
              )}
              {originalValue && customized && (
                <button
                  type="button"
                  onClick={() => resetField(field)}
                  title="Réinitialiser ce réglage"
                  aria-label={`Réinitialiser ${field.label}`}
                  className="ml-auto rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <ResetIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <FieldInput
              id={inputId}
              field={field}
              value={current}
              onChange={(next) => setField(field.name, next)}
              hasError={Boolean(fieldErrors?.length)}
            />

            {fieldErrors?.map((message, index) => (
              <p key={index} className="text-[11px] text-red-600">
                {message}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({
  id,
  field,
  value,
  onChange,
  hasError,
}: {
  id: string;
  field: FieldDescriptor;
  value: unknown;
  onChange: (next: unknown) => void;
  hasError: boolean;
}) {
  const baseInputClass = `w-full rounded-md border px-2.5 py-1.5 text-[13px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
    hasError ? "border-red-400" : "border-gray-300 focus:border-indigo-500"
  }`;

  switch (field.kind) {
    case "text":
    case "url":
    case "email":
      return (
        <input
          id={id}
          type={field.kind === "email" ? "email" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={baseInputClass}
        />
      );

    case "textarea":
      return (
        <textarea
          id={id}
          rows={3}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={baseInputClass}
        />
      );

    case "number":
      return (
        <input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
          className={baseInputClass}
        />
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 text-[13px] text-gray-700">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/30"
          />
          Activé
        </label>
      );

    case "enum":
      return (
        <select
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className={baseInputClass}
        >
          {!field.required && <option value="">— Hériter du template —</option>}
          {field.enumOptions?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );

    case "color":
      return <ColorInput id={id} value={typeof value === "string" ? value : ""} onChange={onChange} />;

    case "id-list":
      return (
        <IdListInput
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      );

    case "object":
      return (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <SchemaForm
            fields={field.fields ?? []}
            value={isPlainObject(value) ? value : {}}
            onChange={onChange}
            idPrefix={id}
          />
        </div>
      );

    case "array-object":
      return (
        <ArrayObjectInput
          field={field}
          value={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
          onChange={onChange}
          idPrefix={id}
        />
      );

    default:
      return (
        <p className="text-[11px] italic text-gray-400">
          Ce champ ne peut pas encore être édité visuellement ici.
        </p>
      );
  }
}

function ColorInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const isHex = /^#[0-9a-fA-F]{6}$/.test(value);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Sélecteur de couleur"
        value={isHex ? value : "#000000"}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-9 shrink-0 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
      />
      <input
        id={id}
        type="text"
        placeholder="#000000, rgba(...), var(--color-primary)..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      />
    </div>
  );
}

function IdListInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addId() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] text-indigo-700"
          >
            {id}
            <button
              type="button"
              onClick={() => onChange(value.filter((existing) => existing !== id))}
              aria-label={`Retirer ${id}`}
              className="text-indigo-400 hover:text-indigo-700"
            >
              <CloseSmallIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          placeholder="Identifiant (ex. catalogue)..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addId();
            }
          }}
          className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-[13px] text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        />
        <button
          type="button"
          onClick={addId}
          className="shrink-0 rounded-md border border-gray-300 px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:border-gray-400"
        >
          Ajouter
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        Identifiants du catalogue (aucun sélecteur visuel dans cet environnement de démonstration).
      </p>
    </div>
  );
}

function ArrayObjectInput({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: FieldDescriptor;
  value: Record<string, unknown>[];
  onChange: (next: Record<string, unknown>[]) => void;
  idPrefix: string;
}) {
  const itemFields = field.itemFields ?? [];
  const canRemove = field.min === undefined || value.length > field.min;
  const canAdd = field.max === undefined || value.length < field.max;

  return (
    <div className="flex flex-col gap-3">
      {value.map((item, index) => (
        <div key={index} className="rounded-md border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
              {field.label} {index + 1}
            </p>
            <button
              type="button"
              disabled={!canRemove}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="text-[11px] font-medium text-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Supprimer
            </button>
          </div>
          <SchemaForm
            fields={itemFields}
            value={item}
            onChange={(next) => onChange(value.map((existing, i) => (i === index ? next : existing)))}
            idPrefix={`${idPrefix}-${index}`}
          />
        </div>
      ))}
      <button
        type="button"
        disabled={!canAdd}
        onClick={() =>
          onChange([
            ...value,
            Object.fromEntries(itemFields.map((f) => [f.name, emptyValueForField(f)])),
          ])
        }
        className="self-start rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        + Ajouter {field.label.toLowerCase()}
      </button>
    </div>
  );
}
