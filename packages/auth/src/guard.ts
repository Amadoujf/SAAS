import type { Permission } from "./permissions";

export class PermissionDeniedError extends Error {
  constructor(permission: Permission) {
    super(`Permission refusée : "${permission}" requise.`);
    this.name = "PermissionDeniedError";
  }
}

export function hasPermission(granted: readonly string[], required: Permission): boolean {
  return granted.includes(required);
}

export function hasAnyPermission(granted: readonly string[], required: Permission[]): boolean {
  return required.some((p) => granted.includes(p));
}

/**
 * À appeler au tout début de chaque route serveur / server action mutante.
 * Lance une erreur explicite plutôt que de laisser passer silencieusement une action
 * non autorisée — voir docs/05-roles-permissions.md#55-règle-générale-de-vérification.
 */
export function assertPermission(granted: readonly string[], required: Permission): void {
  if (!hasPermission(granted, required)) {
    throw new PermissionDeniedError(required);
  }
}
