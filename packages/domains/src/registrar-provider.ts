/**
 * Abstraction du BUREAU D'ENREGISTREMENT (registrar) — voir docs/13, « FUTURE
 * INTÉGRATION OPENSRS ». À ne JAMAIS confondre avec `DomainProvider` (voir types.ts) :
 *
 * - `DomainProvider` gère le DNS technique/routage/HTTPS/custom hostnames d'un
 *   domaine DÉJÀ possédé par le client (peu importe où il l'a acheté).
 * - `DomainRegistrarProvider` gérera l'ACHAT du nom de domaine lui-même
 *   (disponibilité, prix, enregistrement, renouvellement, transfert, contacts,
 *   verrouillage, code d'autorisation) — un sujet totalement différent.
 *
 * Cette étape pose UNIQUEMENT l'interface, les types, les statuts, un adaptateur
 * manuel (le Super Admin achète lui-même chez un registrar externe puis saisit les
 * informations, voir `ManualRegistrarProvider`) et un adaptateur fictif pour les
 * tests (`FakeRegistrarProvider`) — jamais de connexion réelle à OpenSRS sans compte,
 * clés et tests sandbox (voir la contrainte explicite du cahier des charges).
 */

export interface DomainAvailabilityResult {
  domain: string;
  available: boolean;
  priceXOF?: number;
  currency?: "XOF";
}

export interface RegistrarContact {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  country: string; // code ISO 3166-1 alpha-2, ex. "SN".
}

export type DomainRegistrationStatus =
  | "not_registered"
  | "pending"
  | "registered"
  | "renewal_pending"
  | "expired"
  | "transfer_pending"
  | "transfer_completed"
  | "failed";

export interface DomainRegistrationResult {
  externalRegistrarId: string;
  status: DomainRegistrationStatus;
  expiresAt: Date;
}

export interface DomainRenewalResult {
  status: DomainRegistrationStatus;
  expiresAt: Date;
}

export interface DomainTransferResult {
  status: DomainRegistrationStatus;
}

export interface DomainRegistrarProvider {
  readonly name: "opensrs" | "manual" | "fake";

  checkAvailability(domain: string): Promise<DomainAvailabilityResult>;
  register(domain: string, years: number, contact: RegistrarContact): Promise<DomainRegistrationResult>;
  renew(externalRegistrarId: string, years: number): Promise<DomainRenewalResult>;
  /** Code d'autorisation ("auth code"/EPP code) nécessaire au transfert ENTRANT d'un
   *  domaine déjà enregistré ailleurs. */
  requestTransfer(domain: string, authCode: string, contact: RegistrarContact): Promise<DomainTransferResult>;
  setLock(externalRegistrarId: string, locked: boolean): Promise<void>;
  getAuthCode(externalRegistrarId: string): Promise<string>;
}

/**
 * Adaptateur "manuel" : aucune automatisation, l'équipe achète le domaine directement
 * chez un registrar externe (ex. le futur compte OpenSRS, ou tout autre pour
 * l'instant) puis saisit les informations dans l'interface Super Admin — voir
 * « Prévoir un mode permettant à notre équipe d'acheter et gérer le domaine à la
 * place du client ». Les méthodes qui supposeraient une automatisation réelle lèvent
 * explicitement, pour ne jamais laisser croire à un achat/renouvellement automatique
 * qui n'a pas eu lieu.
 */
export class ManualRegistrarProvider implements DomainRegistrarProvider {
  readonly name = "manual" as const;

  async checkAvailability(domain: string): Promise<DomainAvailabilityResult> {
    return { domain, available: false }; // inconnu sans registrar réel — l'équipe vérifie elle-même.
  }

  async register(_domain: string, _years: number, _contact: RegistrarContact): Promise<DomainRegistrationResult> {
    throw new Error(
      "ManualRegistrarProvider : l'achat est effectué manuellement par l'équipe, puis saisi via l'interface Super Admin — pas d'automatisation.",
    );
  }

  async renew(_externalRegistrarId: string, _years: number): Promise<DomainRenewalResult> {
    throw new Error("ManualRegistrarProvider : le renouvellement est effectué manuellement par l'équipe.");
  }

  async requestTransfer(
    _domain: string,
    _authCode: string,
    _contact: RegistrarContact,
  ): Promise<DomainTransferResult> {
    throw new Error("ManualRegistrarProvider : le transfert est effectué manuellement par l'équipe.");
  }

  async setLock(_externalRegistrarId: string, _locked: boolean): Promise<void> {
    throw new Error("ManualRegistrarProvider : le verrouillage est géré manuellement chez le registrar.");
  }

  async getAuthCode(_externalRegistrarId: string): Promise<string> {
    throw new Error("ManualRegistrarProvider : le code d'autorisation est obtenu manuellement chez le registrar.");
  }
}

/**
 * Adaptateur FICTIF — pour les tests et la démonstration UNIQUEMENT (voir
 * docs/13, « DÉMONSTRATION »). Simule un registrar complet en mémoire, sans jamais
 * atteindre un vrai service externe.
 */
export class FakeRegistrarProvider implements DomainRegistrarProvider {
  readonly name = "fake" as const;
  private readonly registry = new Map<string, DomainRegistrationResult>();

  async checkAvailability(domain: string): Promise<DomainAvailabilityResult> {
    const available = !this.registry.has(domain);
    return { domain, available, priceXOF: available ? 8_000 : undefined, currency: "XOF" };
  }

  async register(
    domain: string,
    years: number,
    _contact: RegistrarContact,
  ): Promise<DomainRegistrationResult> {
    if (this.registry.has(domain)) {
      throw new Error(`FakeRegistrarProvider : "${domain}" est déjà enregistré.`);
    }
    const result: DomainRegistrationResult = {
      externalRegistrarId: `fake-${domain}`,
      status: "registered",
      expiresAt: new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000),
    };
    // Stocke une copie distincte : l'appelant garde son propre instantané, jamais
    // muté rétroactivement par un futur `renew()` sur l'entrée interne.
    this.registry.set(domain, { ...result });
    return result;
  }

  async renew(externalRegistrarId: string, years: number): Promise<DomainRenewalResult> {
    const entry = [...this.registry.values()].find((r) => r.externalRegistrarId === externalRegistrarId);
    if (!entry) throw new Error(`FakeRegistrarProvider : "${externalRegistrarId}" introuvable.`);
    entry.expiresAt = new Date(entry.expiresAt.getTime() + years * 365 * 24 * 60 * 60 * 1000);
    return { status: "registered", expiresAt: entry.expiresAt };
  }

  async requestTransfer(
    domain: string,
    _authCode: string,
    _contact: RegistrarContact,
  ): Promise<DomainTransferResult> {
    return { status: this.registry.has(domain) ? "failed" : "transfer_pending" };
  }

  async setLock(_externalRegistrarId: string, _locked: boolean): Promise<void> {
    // Pas d'état de verrouillage simulé séparément — suffisant pour les tests actuels.
  }

  async getAuthCode(_externalRegistrarId: string): Promise<string> {
    return "FAKE-AUTH-CODE";
  }
}
