"use client";

import { createContext, useContext } from "react";

/** Choix proposés pour un champ « liste d'identifiants » (ex. `productIds`,
 *  `listingIds`) : les contenus RÉELS de l'entreprise, par nom. Absent = saisie libre
 *  d'identifiants (comportement d'origine de l'éditeur). */
export type EditorIdOptions = Record<string, { id: string; label: string }[]>;

const EditorIdOptionsContext = createContext<EditorIdOptions>({});

export const EditorIdOptionsProvider = EditorIdOptionsContext.Provider;

export function useEditorIdOptions(): EditorIdOptions {
  return useContext(EditorIdOptionsContext);
}
