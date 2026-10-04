import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { nextCounterValue } from "./counters";
import { resolveOrCreateCustomer, type CustomerInput } from "./customer-registry";
import { normalizeSenegalPhone } from "./senegal-reference";
import { isIsoDate } from "./service-slots";

/**
 * Livraison (secteur `delivery`) — sociétés de coursiers qui livrent pour le compte de
 * leurs clients (boutiques, particuliers). S'appuie sur les briques communes : les
 * expéditeurs sont des clients du registre commun, les livreurs et les zones tarifaires
 * sont ceux de l'entreprise (`Deliverer`, `DeliveryZone`).
 *
 * Règles tenues ici (et doublées en base) :
 * - le tarif d'une course est calculé par le serveur (zone + format), jamais saisi par le client ;
 * - une course « livrée » a toujours une preuve (code du destinataire vérifié, ou nom du
 *   réceptionnaire) ET l'encaissement EXACT de la somme attendue — sinon c'est un échec ;
 * - après un échec : nouvelle tentative (plafonnée) ou retour à l'expéditeur, motivés ;
 * - un livreur ne voit et ne fait avancer que SES courses (lien personnel) ;
 * - les espèces suivent un chemin vérifiable : encaissées par le livreur → versées au
 *   bureau (reçu VER-, écart motivé) → reversées à l'expéditeur, tarifs à sa charge
 *   déduits (reçu REV-). Chaque course n'est versée et reversée qu'une fois.
 */

export const COURIER_STATUSES = ["pending", "assigned", "picked_up", "in_transit", "delivered", "failed", "returning", "returned", "canceled"] as const;
export type CourierStatus = (typeof COURIER_STATUSES)[number];
export const PACKAGE_SIZES = ["small", "medium", "large"] as const;
export const SETTLEMENT_METHODS = ["cash", "wave", "orange_money", "free_money", "bank_transfer", "other"] as const;
export const OPEN_STATUSES: CourierStatus[] = ["pending", "assigned", "picked_up", "in_transit", "failed", "returning"];

export class CourierError extends Error {}

type Tx = Prisma.TransactionClient;
/** Qui agit : l'équipe (tout), un livreur (ses courses), le client (demande en ligne). */
export type CourierActor = { type: "staff"; userId: string | null } | { type: "deliverer"; delivererId: string } | { type: "customer" } | { type: "system" };

const includes = <T extends readonly string[]>(list: T, v: unknown): v is T[number] => typeof v === "string" && (list as readonly string[]).includes(v);
const int = (v: unknown, a: number, b: number) => Number.isInteger(v) && (v as number) >= a && (v as number) <= b;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const opt = (v: unknown, max: number) => text(v, max) || null;

/** Somme que le livreur doit encaisser auprès du destinataire. */
export const expectedCollection = (j: { codAmount: number; fee: number; feePaidBy: string }) => j.codAmount + (j.feePaidBy === "recipient" ? j.fee : 0);

// ============================================================================
// RÉGLAGES ET TARIFS
// ============================================================================

const DEFAULT_SETTINGS = { mediumSurcharge: 500, largeSurcharge: 1500, maxCod: 500_000, maxAttempts: 3, publicRequests: true };
export type CourierSettingsInput = Partial<typeof DEFAULT_SETTINGS>;

export async function getCourierSettings(tx: Tx, tenantId: string) {
  const s = await tx.courierSettings.findUnique({ where: { tenantId } });
  return s ? { mediumSurcharge: s.mediumSurcharge, largeSurcharge: s.largeSurcharge, maxCod: s.maxCod, maxAttempts: s.maxAttempts, publicRequests: s.publicRequests } : { ...DEFAULT_SETTINGS };
}

export async function updateCourierSettings(tx: Tx, tenantId: string, patch: CourierSettingsInput) {
  if (patch.mediumSurcharge !== undefined && !int(patch.mediumSurcharge, 0, 1_000_000)) throw new CourierError("Supplément invalide.");
  if (patch.largeSurcharge !== undefined && !int(patch.largeSurcharge, 0, 1_000_000)) throw new CourierError("Supplément invalide.");
  if (patch.maxCod !== undefined && !int(patch.maxCod, 0, 10_000_000)) throw new CourierError("Plafond d'encaissement invalide.");
  if (patch.maxAttempts !== undefined && !int(patch.maxAttempts, 1, 10)) throw new CourierError("Nombre de tentatives : entre 1 et 10.");
  const data = {
    ...(patch.mediumSurcharge !== undefined ? { mediumSurcharge: patch.mediumSurcharge } : {}),
    ...(patch.largeSurcharge !== undefined ? { largeSurcharge: patch.largeSurcharge } : {}),
    ...(patch.maxCod !== undefined ? { maxCod: patch.maxCod } : {}),
    ...(patch.maxAttempts !== undefined ? { maxAttempts: patch.maxAttempts } : {}),
    ...(patch.publicRequests !== undefined ? { publicRequests: !!patch.publicRequests } : {}),
  };
  await tx.courierSettings.upsert({ where: { tenantId }, create: { tenantId, ...DEFAULT_SETTINGS, ...data }, update: data });
  return getCourierSettings(tx, tenantId);
}

/** Tarif d'une course : prix de la zone de destination + supplément de format. */
export async function quoteCourierFee(tx: Tx, tenantId: string, input: { zoneId: string; size: string }) {
  if (!includes(PACKAGE_SIZES, input.size)) throw new CourierError("Format de colis inconnu.");
  const zone = await tx.deliveryZone.findFirst({ where: { id: input.zoneId, tenantId, isActive: true } });
  if (!zone) throw new CourierError("Zone de livraison introuvable.");
  const s = await getCourierSettings(tx, tenantId);
  const surcharge = input.size === "large" ? s.largeSurcharge : input.size === "medium" ? s.mediumSurcharge : 0;
  return { zone, fee: zone.fee + surcharge, surcharge };
}

// ============================================================================
// LIVREURS
// ============================================================================

export async function createCourier(tx: Tx, tenantId: string, input: { name: string; phone: string; vehicleType?: string | null }) {
  const name = text(input.name, 80);
  if (!name) throw new CourierError("Nom du livreur requis.");
  const phone = normalizeSenegalPhone(input.phone);
  if (!phone) throw new CourierError("Numéro de téléphone sénégalais invalide.");
  return tx.deliverer.create({ data: { tenantId, name, phone, vehicleType: opt(input.vehicleType, 30) } });
}

export async function updateCourier(tx: Tx, tenantId: string, delivererId: string, patch: { name?: string; phone?: string; vehicleType?: string | null; isActive?: boolean }) {
  const d = await tx.deliverer.findFirst({ where: { id: delivererId, tenantId } });
  if (!d) throw new CourierError("Livreur introuvable.");
  const phone = patch.phone !== undefined ? normalizeSenegalPhone(patch.phone) : undefined;
  if (phone === null) throw new CourierError("Numéro de téléphone sénégalais invalide.");
  if (patch.name !== undefined && !text(patch.name, 80)) throw new CourierError("Nom du livreur requis.");
  if (patch.isActive === false && (await tx.courierJob.count({ where: { tenantId, delivererId, status: { in: ["assigned", "picked_up", "in_transit", "returning"] } } }))) {
    throw new CourierError("Ce livreur a des courses en cours : réaffectez-les d'abord.");
  }
  return tx.deliverer.update({
    where: { id: delivererId },
    data: {
      ...(patch.name !== undefined ? { name: text(patch.name, 80) } : {}),
      ...(phone ? { phone } : {}),
      ...(patch.vehicleType !== undefined ? { vehicleType: opt(patch.vehicleType, 30) } : {}),
      ...(patch.isActive !== undefined ? { isActive: !!patch.isActive } : {}),
    },
  });
}

/** Révoque le lien d'un livreur (téléphone perdu, départ) : l'ancien cesse aussitôt de fonctionner. */
export async function rotateCourierToken(tx: Tx, tenantId: string, delivererId: string) {
  const { count } = await tx.deliverer.updateMany({ where: { id: delivererId, tenantId }, data: { accessToken: crypto.randomUUID() } });
  if (!count) throw new CourierError("Livreur introuvable.");
  return tx.deliverer.findFirstOrThrow({ where: { id: delivererId, tenantId } });
}

/** Espèces détenues par chaque livreur (courses livrées non encore versées au bureau). */
export async function cashInHand(tx: Tx, tenantId: string, delivererId?: string) {
  const rows = await tx.courierJob.groupBy({ by: ["delivererId"], where: { tenantId, status: "delivered", remittanceId: null, collectedAmount: { gt: 0 }, ...(delivererId ? { delivererId } : {}) }, _sum: { collectedAmount: true }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.delivererId!, { amount: r._sum.collectedAmount ?? 0, jobs: r._count._all }]));
}

export async function listCouriers(tx: Tx, tenantId: string) {
  const [couriers, cash, active] = await Promise.all([
    tx.deliverer.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { name: "asc" }, { phone: "asc" }] }),
    cashInHand(tx, tenantId),
    tx.courierJob.groupBy({ by: ["delivererId"], where: { tenantId, status: { in: ["assigned", "picked_up", "in_transit", "returning"] } }, _count: { _all: true } }),
  ]);
  const load = new Map(active.map((a) => [a.delivererId!, a._count._all]));
  return couriers.map((c) => ({ ...c, cash: cash.get(c.id) ?? { amount: 0, jobs: 0 }, activeJobs: load.get(c.id) ?? 0 }));
}

// ============================================================================
// COURSES
// ============================================================================

export interface CourierJobInput {
  senderId?: string | null;
  sender?: CustomerInput | null;
  pickupName: string;
  pickupPhone: string;
  pickupAddress: string;
  pickupCommune?: string | null;
  recipientName: string;
  recipientPhone: string;
  dropoffAddress: string;
  dropoffCommune?: string | null;
  instructions?: string | null;
  zoneId: string;
  packageDescription: string;
  size: string;
  feePaidBy: string;
  codAmount?: number;
  scheduledDate?: string | null;
  channel: "web" | "dashboard" | "phone" | "whatsapp";
  actor: CourierActor;
}

async function logEvent(tx: Tx, tenantId: string, jobId: string, from: string | null, to: string, actor: CourierActor, note?: string | null) {
  await tx.courierJobEvent.create({
    data: {
      tenantId,
      jobId,
      fromStatus: from,
      toStatus: to,
      note: opt(note, 300),
      actorType: actor.type,
      actorId: actor.type === "staff" ? actor.userId : actor.type === "deliverer" ? actor.delivererId : null,
    },
  });
}

/** Nouvelle course : tarif calculé par le serveur, code de remise à 4 chiffres, liens de suivi. */
export async function createCourierJob(tx: Tx, tenantId: string, input: CourierJobInput) {
  const settings = await getCourierSettings(tx, tenantId);
  if (input.channel === "web" && !settings.publicRequests) throw new CourierError("Les demandes en ligne sont fermées : appelez-nous.");
  const pickupPhone = normalizeSenegalPhone(input.pickupPhone);
  const recipientPhone = normalizeSenegalPhone(input.recipientPhone);
  if (!pickupPhone) throw new CourierError("Téléphone de l'expéditeur invalide.");
  if (!recipientPhone) throw new CourierError("Téléphone du destinataire invalide.");
  for (const [v, label] of [[input.pickupName, "Nom au point de retrait"], [input.pickupAddress, "Adresse de retrait"], [input.recipientName, "Nom du destinataire"], [input.dropoffAddress, "Adresse de livraison"], [input.packageDescription, "Description du colis"]] as const) {
    if (!text(v, 200)) throw new CourierError(`${label} requis.`);
  }
  if (!includes(["sender", "recipient"] as const, input.feePaidBy)) throw new CourierError("Qui paie la course ?");
  const codAmount = input.codAmount ?? 0;
  if (!int(codAmount, 0, settings.maxCod)) throw new CourierError(`Somme à encaisser invalide (plafond ${settings.maxCod} FCFA par course).`);
  if (input.scheduledDate != null && input.scheduledDate !== "" && !isIsoDate(input.scheduledDate)) throw new CourierError("Date souhaitée invalide.");
  const { zone, fee } = await quoteCourierFee(tx, tenantId, { zoneId: input.zoneId, size: input.size });

  let senderId = input.senderId ?? null;
  if (senderId) {
    if (!(await tx.customer.findFirst({ where: { id: senderId, tenantId }, select: { id: true } }))) throw new CourierError("Client expéditeur introuvable.");
  } else {
    if (!input.sender?.firstName?.trim() || !input.sender.phone?.trim()) throw new CourierError("Nom et téléphone de l'expéditeur requis.");
    senderId = (await resolveOrCreateCustomer(tx, tenantId, input.sender)).id;
  }
  const year = new Date().getFullYear();
  const reference = `LIV-${year}-${String(await nextCounterValue(tx, tenantId, `courier-${year}`)).padStart(6, "0")}`;
  const job = await tx.courierJob.create({
    data: {
      tenantId,
      reference,
      senderId,
      pickupName: text(input.pickupName, 80),
      pickupPhone,
      pickupAddress: text(input.pickupAddress, 200),
      pickupCommune: opt(input.pickupCommune, 60),
      recipientName: text(input.recipientName, 80),
      recipientPhone,
      dropoffAddress: text(input.dropoffAddress, 200),
      dropoffCommune: opt(input.dropoffCommune, 60) ?? zone.commune ?? zone.name ?? null,
      instructions: opt(input.instructions, 300),
      zoneId: zone.id,
      packageDescription: text(input.packageDescription, 160),
      size: input.size,
      fee,
      feePaidBy: input.feePaidBy,
      codAmount,
      scheduledDate: input.scheduledDate ? new Date(`${input.scheduledDate}T00:00:00Z`) : null,
      deliveryCode: String(randomInt(0, 10_000)).padStart(4, "0"),
      channel: input.channel,
    },
  });
  await logEvent(tx, tenantId, job.id, null, "pending", input.actor, input.channel === "web" ? "Demande en ligne" : null);
  return job;
}

/** Verrou de ligne + contrôle de portée (un livreur n'agit que sur SES courses). */
async function lockJob(tx: Tx, tenantId: string, jobId: string, actor: CourierActor) {
  const rows = await tx.$queryRaw<{ status: string; delivererId: string | null }[]>`SELECT "status", "delivererId" FROM "CourierJob" WHERE "id" = ${jobId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  const row = rows[0];
  if (!row || (actor.type === "deliverer" && row.delivererId !== actor.delivererId)) throw new CourierError("Course introuvable.");
  return tx.courierJob.findFirstOrThrow({ where: { id: jobId, tenantId } });
}

const staffOnly = (actor: CourierActor) => {
  if (actor.type !== "staff" && actor.type !== "system") throw new CourierError("Action réservée au bureau.");
};

/** Affecter (ou réaffecter) un livreur ; depuis un échec : nouvelle tentative, plafonnée. */
export async function assignCourierJob(tx: Tx, tenantId: string, jobId: string, delivererId: string, actor: CourierActor) {
  staffOnly(actor);
  const job = await lockJob(tx, tenantId, jobId, actor);
  if (!["pending", "assigned", "failed"].includes(job.status)) throw new CourierError("Cette course ne peut plus être affectée.");
  const d = await tx.deliverer.findFirst({ where: { id: delivererId, tenantId, isActive: true } });
  if (!d) throw new CourierError("Livreur introuvable ou inactif.");
  if (job.status === "failed") {
    const { maxAttempts } = await getCourierSettings(tx, tenantId);
    if (job.attempts >= maxAttempts) throw new CourierError(`${job.attempts} tentatives déjà faites : la course doit être retournée à l'expéditeur.`);
  }
  if (job.status === "assigned" && job.delivererId === delivererId) return job;
  const updated = await tx.courierJob.update({ where: { id: jobId }, data: { status: "assigned", delivererId, failureReason: null } });
  await logEvent(tx, tenantId, jobId, job.status, "assigned", actor, `${job.status === "failed" ? "Nouvelle tentative — " : ""}${d.name ?? d.phone}`);
  return updated;
}

/** Colis pris en charge, puis en route. */
export async function advanceCourierJob(tx: Tx, tenantId: string, jobId: string, to: "picked_up" | "in_transit", actor: CourierActor) {
  const job = await lockJob(tx, tenantId, jobId, actor);
  const allowed = to === "picked_up" ? job.status === "assigned" : job.status === "picked_up";
  if (!allowed) throw new CourierError(to === "picked_up" ? "La course doit être affectée avant la prise en charge." : "Le colis doit être pris en charge avant d'être en route.");
  const updated = await tx.courierJob.update({ where: { id: jobId }, data: { status: to } });
  await logEvent(tx, tenantId, jobId, job.status, to, actor);
  return updated;
}

export type DeliveryProof = { type: "code"; code: string } | { type: "name"; name: string };

/**
 * Remise au destinataire : preuve obligatoire (code vérifié par le serveur, ou nom du
 * réceptionnaire) et somme encaissée égale à la somme attendue — sinon, c'est un échec.
 */
export async function deliverCourierJob(tx: Tx, tenantId: string, jobId: string, input: { proof: DeliveryProof; collectedAmount: number; actor: CourierActor }) {
  const job = await lockJob(tx, tenantId, jobId, input.actor);
  if (job.status !== "picked_up" && job.status !== "in_transit") throw new CourierError("Le colis n'est pas en cours de livraison.");
  const expected = expectedCollection(job);
  if (!Number.isInteger(input.collectedAmount) || input.collectedAmount !== expected) {
    throw new CourierError(`Somme à encaisser : ${expected} FCFA exactement. Si le destinataire ne peut pas payer, déclarez un échec.`);
  }
  let proofName: string | null = null;
  if (input.proof.type === "code") {
    if (!/^\d{4}$/.test(input.proof.code) || input.proof.code !== job.deliveryCode) throw new CourierError("Code de remise incorrect.");
  } else {
    proofName = text(input.proof.name, 80);
    if (!proofName) throw new CourierError("Indiquez le nom de la personne qui a reçu le colis.");
  }
  const now = new Date();
  const updated = await tx.courierJob.update({
    where: { id: jobId },
    data: { status: "delivered", proofType: input.proof.type, proofName, collectedAmount: expected, collectedAt: expected > 0 ? now : null, deliveredAt: now, attempts: job.attempts + 1 },
  });
  await logEvent(tx, tenantId, jobId, job.status, "delivered", input.actor, input.proof.type === "code" ? "Code du destinataire vérifié" : `Remis à ${proofName}`);
  return updated;
}

/** Échec de livraison (absent, refus, adresse introuvable…) : motif obligatoire. */
export async function failCourierJob(tx: Tx, tenantId: string, jobId: string, reason: string, actor: CourierActor) {
  const why = text(reason, 200);
  if (!why) throw new CourierError("Indiquez le motif de l'échec.");
  const job = await lockJob(tx, tenantId, jobId, actor);
  if (job.status !== "picked_up" && job.status !== "in_transit") throw new CourierError("Le colis n'est pas en cours de livraison.");
  const updated = await tx.courierJob.update({ where: { id: jobId }, data: { status: "failed", failureReason: why, attempts: job.attempts + 1 } });
  await logEvent(tx, tenantId, jobId, job.status, "failed", actor, why);
  return updated;
}

/** Retour à l'expéditeur après échec (décision du bureau), puis colis rendu. */
export async function startCourierReturn(tx: Tx, tenantId: string, jobId: string, delivererId: string | null, actor: CourierActor) {
  staffOnly(actor);
  const job = await lockJob(tx, tenantId, jobId, actor);
  if (job.status !== "failed") throw new CourierError("Seule une course en échec peut être retournée.");
  const d = delivererId ?? job.delivererId;
  if (!d || !(await tx.deliverer.findFirst({ where: { id: d, tenantId, isActive: true } }))) throw new CourierError("Choisissez le livreur qui rapporte le colis.");
  const updated = await tx.courierJob.update({ where: { id: jobId }, data: { status: "returning", delivererId: d } });
  await logEvent(tx, tenantId, jobId, "failed", "returning", actor, "Retour à l'expéditeur");
  return updated;
}

export async function completeCourierReturn(tx: Tx, tenantId: string, jobId: string, actor: CourierActor, note?: string | null) {
  const job = await lockJob(tx, tenantId, jobId, actor);
  if (job.status !== "returning") throw new CourierError("Cette course n'est pas en retour.");
  const updated = await tx.courierJob.update({ where: { id: jobId }, data: { status: "returned" } });
  await logEvent(tx, tenantId, jobId, "returning", "returned", actor, note ?? "Colis rendu à l'expéditeur");
  return updated;
}

/** Annulation motivée, uniquement avant la prise en charge du colis. */
export async function cancelCourierJob(tx: Tx, tenantId: string, jobId: string, reason: string, actor: CourierActor) {
  staffOnly(actor);
  const why = text(reason, 200);
  if (!why) throw new CourierError("Indiquez le motif de l'annulation.");
  const job = await lockJob(tx, tenantId, jobId, actor);
  if (job.status !== "pending" && job.status !== "assigned") throw new CourierError("Le colis est déjà pris en charge : déclarez un échec puis un retour.");
  const updated = await tx.courierJob.update({ where: { id: jobId }, data: { status: "canceled", cancelReason: why } });
  await logEvent(tx, tenantId, jobId, job.status, "canceled", actor, why);
  return updated;
}

// ============================================================================
// LECTURES
// ============================================================================

const jobInclude = {
  sender: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  deliverer: { select: { id: true, name: true, phone: true, vehicleType: true } },
  zone: { select: { id: true, name: true, region: true, commune: true } },
  remittance: { select: { id: true, receiptNumber: true, receivedAt: true } },
  settlement: { select: { id: true, receiptNumber: true, settledAt: true } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.CourierJobInclude;

export function getCourierJob(tx: Tx, tenantId: string, jobId: string) {
  return tx.courierJob.findFirst({ where: { id: jobId, tenantId }, include: jobInclude });
}

export interface CourierJobFilters {
  status?: string[];
  delivererId?: string;
  senderId?: string;
  date?: string;
  search?: string;
  take?: number;
}

export function listCourierJobs(tx: Tx, tenantId: string, q: CourierJobFilters = {}) {
  const s = text(q.search, 60);
  return tx.courierJob.findMany({
    where: {
      tenantId,
      ...(q.status ? { status: { in: q.status } } : {}),
      ...(q.delivererId ? { delivererId: q.delivererId } : {}),
      ...(q.senderId ? { senderId: q.senderId } : {}),
      ...(q.date && isIsoDate(q.date) ? { createdAt: { gte: new Date(`${q.date}T00:00:00Z`), lt: new Date(new Date(`${q.date}T00:00:00Z`).getTime() + 86_400_000) } } : {}),
      ...(s ? { OR: [{ reference: { contains: s, mode: "insensitive" } }, { recipientName: { contains: s, mode: "insensitive" } }, { recipientPhone: { contains: s.replace(/\s/g, "") } }, { sender: { firstName: { contains: s, mode: "insensitive" } } }] } : {}),
    },
    include: jobInclude,
    orderBy: [{ createdAt: "desc" }],
    take: q.take ?? 300,
  });
}

/** Suivi public : l'expéditeur voit l'avancement (pas le code) ; le destinataire voit le code. */
export async function getCourierTracking(tx: Tx, tenantId: string, token: string) {
  const job = await tx.courierJob.findFirst({
    where: { tenantId, OR: [{ senderToken: token }, { recipientToken: token }] },
    include: { deliverer: { select: { name: true } }, events: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true, note: true } } },
  });
  if (!job) return null;
  const role = job.recipientToken === token ? ("recipient" as const) : ("sender" as const);
  return {
    role,
    reference: job.reference,
    status: job.status as CourierStatus,
    recipientName: job.recipientName,
    dropoffCommune: job.dropoffCommune,
    pickupCommune: job.pickupCommune,
    packageDescription: job.packageDescription,
    delivererFirstName: job.deliverer?.name?.split(" ")[0] ?? null,
    toCollect: expectedCollection(job),
    fee: job.fee,
    feePaidBy: job.feePaidBy,
    codAmount: job.codAmount,
    failureReason: job.failureReason,
    deliveredAt: job.deliveredAt,
    proofType: job.proofType,
    code: role === "recipient" && !["delivered", "returned", "canceled"].includes(job.status) ? job.deliveryCode : null,
    /** Lien du destinataire, à lui transmettre si aucune messagerie n'est branchée (expéditeur seulement). */
    recipientToken: role === "sender" ? job.recipientToken : null,
    events: job.events.map((e) => ({ status: e.toStatus, at: e.createdAt, note: role === "sender" ? e.note : null })),
  };
}

/** Espace livreur (lien personnel) : SES courses en cours et d'aujourd'hui, ses espèces. */
export async function getCourierSpace(tx: Tx, tenantId: string, token: string, now = new Date()) {
  const d = await tx.deliverer.findFirst({ where: { accessToken: token, tenantId, isActive: true } });
  if (!d) return null;
  const since = new Date(now.getTime() - 20 * 3600_000);
  const [jobs, cash] = await Promise.all([
    tx.courierJob.findMany({
      where: { tenantId, delivererId: d.id, OR: [{ status: { in: ["assigned", "picked_up", "in_transit", "returning"] } }, { updatedAt: { gte: since }, status: { in: ["delivered", "failed", "returned"] } }] },
      orderBy: [{ updatedAt: "asc" }],
      select: { id: true, reference: true, status: true, pickupName: true, pickupPhone: true, pickupAddress: true, pickupCommune: true, recipientName: true, recipientPhone: true, dropoffAddress: true, dropoffCommune: true, instructions: true, packageDescription: true, size: true, fee: true, feePaidBy: true, codAmount: true, collectedAmount: true, failureReason: true, attempts: true },
    }),
    cashInHand(tx, tenantId, d.id),
  ]);
  return { deliverer: { id: d.id, name: d.name ?? d.phone }, jobs: jobs.map((j) => ({ ...j, toCollect: expectedCollection(j) })), cash: cash.get(d.id) ?? { amount: 0, jobs: 0 } };
}

// ============================================================================
// ESPÈCES : VERSEMENTS DES LIVREURS, REVERSEMENTS AUX EXPÉDITEURS
// ============================================================================

/**
 * Versement au bureau : toutes les espèces encaissées et non versées du livreur (ou une
 * sélection). Montant attendu calculé ; un écart est accepté seulement s'il est motivé.
 */
export async function recordRemittance(tx: Tx, tenantId: string, input: { delivererId: string; jobIds?: string[]; receivedAmount: number; discrepancyNote?: string | null; receivedBy: string | null }) {
  const d = await tx.deliverer.findFirst({ where: { id: input.delivererId, tenantId } });
  if (!d) throw new CourierError("Livreur introuvable.");
  const ids = input.jobIds?.length ? input.jobIds : null;
  const rows = await tx.$queryRaw<{ id: string; collectedAmount: number }[]>`
    SELECT "id", "collectedAmount" FROM "CourierJob"
     WHERE "tenantId" = ${tenantId} AND "delivererId" = ${d.id} AND "status" = 'delivered'
       AND "remittanceId" IS NULL AND "collectedAmount" > 0
     ORDER BY "deliveredAt" FOR UPDATE`;
  const jobs = ids ? rows.filter((r) => ids.includes(r.id)) : rows;
  if (ids && jobs.length !== ids.length) throw new CourierError("Une des courses choisies est déjà versée ou n'appartient pas à ce livreur.");
  if (!jobs.length) throw new CourierError("Aucune somme à verser pour ce livreur.");
  const expected = jobs.reduce((s, j) => s + j.collectedAmount, 0);
  if (!int(input.receivedAmount, 0, 100_000_000)) throw new CourierError("Montant reçu invalide.");
  const note = opt(input.discrepancyNote, 300);
  if (input.receivedAmount !== expected && !note) throw new CourierError(`Attendu : ${expected} FCFA. Motivez l'écart pour enregistrer un autre montant.`);
  const year = new Date().getFullYear();
  const receiptNumber = `VER-${year}-${String(await nextCounterValue(tx, tenantId, `remit-${year}`)).padStart(6, "0")}`;
  const r = await tx.courierRemittance.create({ data: { tenantId, delivererId: d.id, receiptNumber, expectedAmount: expected, receivedAmount: input.receivedAmount, discrepancyNote: input.receivedAmount === expected ? null : note, receivedBy: input.receivedBy } });
  await tx.courierJob.updateMany({ where: { tenantId, id: { in: jobs.map((j) => j.id) } }, data: { remittanceId: r.id } });
  return { ...r, jobCount: jobs.length };
}

/** Courses réglables pour un expéditeur : livrées (espèces déjà au bureau si encaissées) ou retournées. */
async function settleableJobs(tx: Tx, tenantId: string, senderId: string, lock: boolean) {
  const rows = lock
    ? await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "CourierJob" WHERE "tenantId" = ${tenantId} AND "senderId" = ${senderId} AND "settlementId" IS NULL
          AND ("status" = 'returned' OR ("status" = 'delivered' AND ("collectedAmount" = 0 OR "remittanceId" IS NOT NULL))) FOR UPDATE`
    : null;
  return tx.courierJob.findMany({
    where: {
      tenantId,
      senderId,
      settlementId: null,
      ...(rows ? { id: { in: rows.map((r) => r.id) } } : { OR: [{ status: "returned" }, { status: "delivered", OR: [{ collectedAmount: 0 }, { remittanceId: { not: null } }] }] }),
    },
    orderBy: { deliveredAt: "asc" },
  });
}

/** Ce que la société doit à l'expéditeur : encaissements pour lui − tarifs à sa charge. */
export function computeSettlement(jobs: { status: string; codAmount: number; fee: number; feePaidBy: string }[]) {
  const codTotal = jobs.filter((j) => j.status === "delivered").reduce((s, j) => s + j.codAmount, 0);
  const feesDeducted = jobs.filter((j) => j.feePaidBy === "sender").reduce((s, j) => s + j.fee, 0);
  return { codTotal, feesDeducted, amount: codTotal - feesDeducted };
}

export async function senderBalance(tx: Tx, tenantId: string, senderId: string) {
  const jobs = await settleableJobs(tx, tenantId, senderId, false);
  // Encaissé par un livreur mais pas encore versé au bureau : visible, pas encore reversable.
  const pending = await tx.courierJob.aggregate({ where: { tenantId, senderId, status: "delivered", remittanceId: null, codAmount: { gt: 0 } }, _sum: { codAmount: true }, _count: { _all: true } });
  return { jobs, ...computeSettlement(jobs), notYetRemitted: { amount: pending._sum.codAmount ?? 0, jobs: pending._count._all } };
}

/** Reversement à l'expéditeur : fige les courses couvertes, reçu REV-. */
export async function settleSender(tx: Tx, tenantId: string, input: { senderId: string; method: string; reference?: string | null; settledBy: string | null }) {
  if (!includes(SETTLEMENT_METHODS, input.method)) throw new CourierError("Moyen de reversement inconnu.");
  if (!(await tx.customer.findFirst({ where: { id: input.senderId, tenantId }, select: { id: true } }))) throw new CourierError("Expéditeur introuvable.");
  const jobs = await settleableJobs(tx, tenantId, input.senderId, true);
  if (!jobs.length) throw new CourierError("Rien à régler pour cet expéditeur.");
  const t = computeSettlement(jobs);
  const year = new Date().getFullYear();
  const receiptNumber = `REV-${year}-${String(await nextCounterValue(tx, tenantId, `settle-${year}`)).padStart(6, "0")}`;
  const s = await tx.courierSettlement.create({ data: { tenantId, senderId: input.senderId, receiptNumber, ...t, method: input.method, reference: opt(input.reference, 80), settledBy: input.settledBy } });
  await tx.courierJob.updateMany({ where: { tenantId, id: { in: jobs.map((j) => j.id) } }, data: { settlementId: s.id } });
  return { ...s, jobCount: jobs.length };
}

/** Rapprochement : espèces chez les livreurs, au bureau, dues aux expéditeurs. */
export async function courierReconciliation(tx: Tx, tenantId: string) {
  const [couriers, senders, remittances, settlements] = await Promise.all([
    listCouriers(tx, tenantId),
    tx.courierJob.groupBy({ by: ["senderId"], where: { tenantId, settlementId: null, status: { in: ["delivered", "returned"] } }, _count: { _all: true } }),
    tx.courierRemittance.findMany({ where: { tenantId }, include: { deliverer: { select: { name: true, phone: true } } }, orderBy: { receivedAt: "desc" }, take: 30 }),
    tx.courierSettlement.findMany({ where: { tenantId }, include: { sender: { select: { firstName: true, lastName: true } } }, orderBy: { settledAt: "desc" }, take: 30 }),
  ]);
  const balances = [];
  for (const s of senders) {
    const customer = await tx.customer.findFirstOrThrow({ where: { id: s.senderId, tenantId }, select: { id: true, firstName: true, lastName: true, phone: true } });
    const b = await senderBalance(tx, tenantId, s.senderId);
    if (b.jobs.length || b.notYetRemitted.jobs) balances.push({ sender: customer, jobCount: b.jobs.length, codTotal: b.codTotal, feesDeducted: b.feesDeducted, amount: b.amount, notYetRemitted: b.notYetRemitted });
  }
  const inHands = couriers.reduce((s, c) => s + c.cash.amount, 0);
  const shortfalls = remittances.reduce((s, r) => s + (r.expectedAmount - r.receivedAmount), 0);
  return { couriers, balances: balances.sort((a, b) => b.amount - a.amount), remittances, settlements, totals: { inHands, owedToSenders: balances.reduce((s, b) => s + Math.max(0, b.amount), 0), shortfalls } };
}

export async function courierOverview(tx: Tx, tenantId: string, now = new Date()) {
  const dayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  const [byStatus, deliveredToday, failedToday, cash] = await Promise.all([
    tx.courierJob.groupBy({ by: ["status"], where: { tenantId, status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
    tx.courierJob.count({ where: { tenantId, status: "delivered", deliveredAt: { gte: dayStart } } }),
    tx.courierJobEvent.count({ where: { tenantId, toStatus: "failed", createdAt: { gte: dayStart } } }),
    cashInHand(tx, tenantId),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    pending: count("pending"),
    onTheRoad: count("assigned") + count("picked_up") + count("in_transit"),
    failed: count("failed"),
    returning: count("returning"),
    deliveredToday,
    failedToday,
    cashInHands: [...cash.values()].reduce((s, c) => s + c.amount, 0),
  };
}
