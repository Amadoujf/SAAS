import { hashPassword, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLES } from "@yamacommerce/auth";
import { prisma } from "./client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { formatInvoiceNumber, formatOrderNumber, nextCounterValue } from "./counters";
import { activateSectorDefaults } from "./modules-registry";

/**
 * Données de démonstration.
 *
 * Crée : les formules d'abonnement, les rôles système globaux, un Super Admin, et DEUX
 * entreprises de démonstration distinctes (pour permettre de vérifier immédiatement
 * l'isolation multi-tenant — voir tests/tenant-isolation.test.ts) avec des données
 * réalistes en FCFA.
 *
 * Idempotent : peut être relancé sans dupliquer les données (upsert sur les clés naturelles).
 */
async function main() {
  console.info("Démarrage du seed…");

  // ---------------------------------------------------------------------
  // 1. Formules d'abonnement
  // ---------------------------------------------------------------------
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { name: "Essentiel" },
      update: {},
      create: {
        name: "Essentiel",
        priceMonthly: 15_000,
        priceYearly: 150_000,
        trialDays: 14,
        maxProducts: 50,
        maxEmployees: 2,
        maxShops: 1,
        // Limites de médiathèque mises à jour le 21 septembre 2026 (voir docs/12 §12.2,
        // « médiathèque R2 ») : storageMB passe de 500 à 2 048 (2 Go).
        storageMB: 2_048,
        maxImageFileMB: 10,
        maxVideoFileMB: 200,
        maxDocumentFileMB: 10,
        maxMediaFileCount: 2_000,
        monthlyUploadMB: 2_048,
        customDomainAllowed: false,
        advancedReports: false,
        whatsappAutomation: false,
        commissionRate: 1.5,
        maxAIGenerationsPerMonth: 20,
        maxAIImagesAnalyzedPerMonth: 20,
        maxAIProductsImportedPerMonth: 50,
        aiEstimatedCostCapXOF: 5_000,
        features: ["catalog", "orders", "invoices", "cod_payment"],
      },
    }),
    prisma.plan.upsert({
      where: { name: "Business" },
      update: {},
      create: {
        name: "Business",
        priceMonthly: 35_000,
        priceYearly: 350_000,
        trialDays: 14,
        maxProducts: 500,
        maxEmployees: 8,
        maxShops: 2,
        storageMB: 10_240, // 10 Go — voir docs/12 §12.2 (21 septembre 2026)
        maxImageFileMB: 20,
        maxVideoFileMB: 500,
        maxDocumentFileMB: 20,
        maxMediaFileCount: 10_000,
        monthlyUploadMB: 10_240,
        customDomainAllowed: true,
        advancedReports: false,
        whatsappAutomation: true,
        commissionRate: 1,
        maxAIGenerationsPerMonth: 150,
        maxAIImagesAnalyzedPerMonth: 150,
        maxAIProductsImportedPerMonth: 500,
        aiEstimatedCostCapXOF: 20_000,
        features: ["catalog", "orders", "invoices", "cod_payment", "online_payment", "whatsapp"],
      },
    }),
    prisma.plan.upsert({
      where: { name: "Premium" },
      update: {},
      create: {
        name: "Premium",
        priceMonthly: 75_000,
        priceYearly: 750_000,
        trialDays: 14,
        maxProducts: 5_000,
        maxEmployees: 25,
        maxShops: 5,
        storageMB: 51_200, // 50 Go — voir docs/12 §12.2 (21 septembre 2026)
        maxImageFileMB: 30,
        maxVideoFileMB: 1_024,
        maxDocumentFileMB: 50,
        maxMediaFileCount: 50_000,
        monthlyUploadMB: 51_200,
        customDomainAllowed: true,
        advancedReports: true,
        whatsappAutomation: true,
        commissionRate: 0.5,
        maxAIGenerationsPerMonth: 600,
        maxAIImagesAnalyzedPerMonth: 600,
        maxAIProductsImportedPerMonth: 5_000,
        aiEstimatedCostCapXOF: 60_000,
        features: [
          "catalog",
          "orders",
          "invoices",
          "cod_payment",
          "online_payment",
          "whatsapp",
          "advanced_reports",
          "loyalty",
        ],
      },
    }),
    prisma.plan.upsert({
      where: { name: "Entreprise" },
      update: {},
      create: {
        name: "Entreprise",
        priceMonthly: 150_000,
        priceYearly: 1_500_000,
        trialDays: 30,
        maxProducts: 100_000,
        maxEmployees: 200,
        maxShops: 50,
        // "Configurable" (voir docs/12 §12.2) : valeur par défaut généreuse, ajustée
        // au cas par cas par contrat — même convention que maxProducts/maxEmployees
        // ci-dessus pour cette formule.
        storageMB: 200_000,
        maxImageFileMB: 50,
        maxVideoFileMB: 2_048,
        maxDocumentFileMB: 100,
        maxMediaFileCount: 500_000,
        monthlyUploadMB: 200_000,
        customDomainAllowed: true,
        advancedReports: true,
        whatsappAutomation: true,
        commissionRate: 0,
        maxAIGenerationsPerMonth: 5_000,
        maxAIImagesAnalyzedPerMonth: 5_000,
        maxAIProductsImportedPerMonth: 100_000,
        aiEstimatedCostCapXOF: null,
        features: [
          "catalog",
          "orders",
          "invoices",
          "cod_payment",
          "online_payment",
          "whatsapp",
          "advanced_reports",
          "loyalty",
          "multi_shop",
          "own_merchant_credentials",
        ],
      },
    }),
  ]);
  const essentiel = plans[0];
  console.info(`  ✓ ${plans.length} formules d'abonnement`);

  // ---------------------------------------------------------------------
  // 2. Rôles système globaux (tenantId = null)
  // ---------------------------------------------------------------------
  // Note : on évite volontairement `upsert` avec `tenantId: null` dans la clé composée
  // `tenantId_name` — Prisma type cette clé en `string` (non nullable) même si le champ
  // est nullable en base, ce qui la rend inutilisable ici. `findFirst` + create/update
  // contourne le problème et reste idempotent (renforcé par l'index unique partiel
  // `Role_global_name_unique` posé par la migration RLS).
  const roleByName = new Map<string, string>();
  for (const roleName of SYSTEM_ROLES) {
    const existing = await prisma.role.findFirst({ where: { tenantId: null, name: roleName } });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { permissions: SYSTEM_ROLE_PERMISSIONS[roleName] },
        })
      : await prisma.role.create({
          data: {
            tenantId: null,
            name: roleName,
            isSystem: true,
            permissions: SYSTEM_ROLE_PERMISSIONS[roleName],
          },
        });
    roleByName.set(roleName, role.id);
  }
  console.info(`  ✓ ${SYSTEM_ROLES.length} rôles système globaux`);

  // ---------------------------------------------------------------------
  // 3. Super Admin
  // ---------------------------------------------------------------------
  const superAdminEmail = process.env.SUPERADMIN_SEED_EMAIL ?? "superadmin@yamacommerce.ai";
  const superAdminPassword = process.env.SUPERADMIN_SEED_PASSWORD ?? "ChangeMoi!2026";
  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      fullName: "Super Administrateur YamaCommerce",
      passwordHash: await hashPassword(superAdminPassword),
      isSuperAdmin: true,
    },
  });
  console.info(`  ✓ Super Admin (${superAdminEmail})`);

  // ---------------------------------------------------------------------
  // 3bis. Registre secteurs / modules (voir docs/11-secteurs-et-modules.md)
  // ---------------------------------------------------------------------
  await seedSectorAndModuleRegistry();
  console.info(
    `  ✓ Registre secteurs/modules (${SECTORS.length} secteurs, ${MODULES.length} modules)`,
  );

  // ---------------------------------------------------------------------
  // 4. Deux entreprises de démonstration (pour les tests d'isolation)
  // ---------------------------------------------------------------------
  await seedDemoTenant({
    slug: "boutique-aida",
    name: "Boutique Aïda",
    businessType: "ECOMMERCE",
    sectorKey: "ecommerce",
    ownerEmail: "aida@boutique-aida.sn",
    ownerName: "Aïda Diop",
    planId: essentiel.id,
    ownerRoleId: roleByName.get("OWNER")!,
    product: { name: "Ensemble boubou brodé", price: 45_000, sku: "BA-BOUBOU-001" },
    customer: { firstName: "Fatou", lastName: "Ndiaye", phone: "+221771234567" },
  });

  await seedDemoTenant({
    slug: "teranga-auto",
    name: "Teranga Auto",
    businessType: "AUTOMOBILE",
    sectorKey: "automobile",
    ownerEmail: "contact@teranga-auto.sn",
    ownerName: "Moussa Fall",
    planId: essentiel.id,
    ownerRoleId: roleByName.get("OWNER")!,
    product: { name: "Toyota Corolla 2018 — révisée", price: 8_500_000, sku: "TA-COROLLA-2018" },
    customer: { firstName: "Cheikh", lastName: "Sarr", phone: "+221781234567" },
  });

  console.info("Seed terminé avec succès.");
}

/**
 * Registre des secteurs — reflète exactement docs/11-secteurs-et-modules.md §11.3
 * (10 secteurs système) + l'option « Autre activité » (§11.7.1, aucun module par défaut).
 */
const SECTORS: Array<{ key: string; name: string; defaultModuleKeys: string[] }> = [
  {
    key: "ecommerce",
    name: "Boutiques, commerçants et grossistes",
    defaultModuleKeys: ["catalog", "inventory", "delivery_zones", "wholesale_pricing"],
  },
  {
    key: "fashion",
    name: "Mode et vêtements",
    defaultModuleKeys: ["catalog", "inventory", "variants_advanced", "lookbook", "delivery_zones"],
  },
  {
    key: "restaurant",
    name: "Restauration",
    defaultModuleKeys: ["catalog", "table_reservations", "qr_ordering", "delivery_zones"],
  },
  {
    key: "real_estate",
    name: "Immobilier",
    defaultModuleKeys: [
      "listings",
      "leases",
      "rent_collection",
      "property_maintenance",
      "visit_requests",
    ],
  },
  {
    key: "travel_agency",
    name: "Agences de voyage",
    defaultModuleKeys: ["listings", "departures", "visa_requests", "traveler_documents"],
  },
  {
    key: "automobile",
    name: "Automobile",
    defaultModuleKeys: ["listings", "import_tracking", "test_drive_appointments", "leads"],
  },
  {
    key: "hospitality",
    name: "Hôtels et locations",
    defaultModuleKeys: ["listings", "availability_calendar", "housekeeping"],
  },
  {
    key: "services",
    name: "Salons et prestataires de services",
    defaultModuleKeys: ["service_catalog", "appointments", "staff_availability"],
  },
  {
    key: "education",
    name: "Écoles et centres de formation",
    defaultModuleKeys: [
      "courses",
      "enrollments",
      "academic_tracking",
      "student_portal",
      "parent_portal",
    ],
  },
  {
    key: "delivery",
    name: "Services de livraison",
    defaultModuleKeys: ["dispatch", "delivery_zones", "deliverer_tracking", "cod_reconciliation"],
  },
  {
    key: "custom",
    name: "Autre activité",
    defaultModuleKeys: [], // composition manuelle — voir docs/11 §11.7.1
  },
];

/** Catalogue des modules — noyau (core) + sectoriels, voir docs/11 §11.2 et §11.4. */
const MODULES: Array<{
  key: string;
  name: string;
  category: "core" | "sector";
  sectorKeys: string[];
}> = [
  // Noyau commun
  { key: "auth", name: "Authentification", category: "core", sectorKeys: [] },
  { key: "businesses", name: "Gestion de l'entreprise", category: "core", sectorKeys: [] },
  { key: "customers", name: "Clients", category: "core", sectorKeys: [] },
  { key: "employees", name: "Employés, rôles et permissions", category: "core", sectorKeys: [] },
  { key: "payments", name: "Paiements", category: "core", sectorKeys: [] },
  { key: "invoicing", name: "Facturation", category: "core", sectorKeys: [] },
  { key: "emails", name: "E-mails", category: "core", sectorKeys: [] },
  { key: "whatsapp", name: "WhatsApp", category: "core", sectorKeys: [] },
  { key: "ai", name: "Intelligence artificielle", category: "core", sectorKeys: [] },
  { key: "subscriptions", name: "Abonnements", category: "core", sectorKeys: [] },
  { key: "domains", name: "Domaines et sous-domaines", category: "core", sectorKeys: [] },
  { key: "visual_editor", name: "Éditeur visuel", category: "core", sectorKeys: [] },
  { key: "files", name: "Gestion des fichiers", category: "core", sectorKeys: [] },
  { key: "analytics", name: "Analyses et rapports", category: "core", sectorKeys: [] },
  { key: "settings", name: "Paramètres généraux", category: "core", sectorKeys: [] },
  // E-commerce / mode / restauration
  {
    key: "catalog",
    name: "Catalogue",
    category: "sector",
    sectorKeys: ["ecommerce", "fashion", "restaurant"],
  },
  { key: "inventory", name: "Stock", category: "sector", sectorKeys: ["ecommerce", "fashion"] },
  {
    key: "delivery_zones",
    name: "Zones de livraison",
    category: "sector",
    sectorKeys: ["ecommerce", "fashion", "restaurant", "delivery"],
  },
  { key: "wholesale_pricing", name: "Prix de gros", category: "sector", sectorKeys: ["ecommerce"] },
  {
    key: "variants_advanced",
    name: "Variantes avancées",
    category: "sector",
    sectorKeys: ["fashion"],
  },
  { key: "lookbook", name: "Lookbook", category: "sector", sectorKeys: ["fashion"] },
  {
    key: "table_reservations",
    name: "Réservation de table",
    category: "sector",
    sectorKeys: ["restaurant"],
  },
  {
    key: "qr_ordering",
    name: "Commande par QR code",
    category: "sector",
    sectorKeys: ["restaurant"],
  },
  // Immobilier
  {
    key: "listings",
    name: "Annonces (biens/circuits/véhicules/chambres)",
    category: "sector",
    sectorKeys: ["real_estate", "travel_agency", "automobile", "hospitality"],
  },
  { key: "leases", name: "Baux", category: "sector", sectorKeys: ["real_estate"] },
  {
    key: "rent_collection",
    name: "Encaissement des loyers",
    category: "sector",
    sectorKeys: ["real_estate"],
  },
  {
    key: "property_maintenance",
    name: "Maintenance des biens",
    category: "sector",
    sectorKeys: ["real_estate"],
  },
  {
    key: "visit_requests",
    name: "Demandes de visite",
    category: "sector",
    sectorKeys: ["real_estate"],
  },
  // Voyage
  {
    key: "departures",
    name: "Calendrier des départs",
    category: "sector",
    sectorKeys: ["travel_agency"],
  },
  {
    key: "visa_requests",
    name: "Demandes de visa",
    category: "sector",
    sectorKeys: ["travel_agency"],
  },
  {
    key: "traveler_documents",
    name: "Documents voyageurs",
    category: "sector",
    sectorKeys: ["travel_agency"],
  },
  // Automobile
  {
    key: "import_tracking",
    name: "Suivi d'importation",
    category: "sector",
    sectorKeys: ["automobile"],
  },
  {
    key: "test_drive_appointments",
    name: "Essais véhicule",
    category: "sector",
    sectorKeys: ["automobile"],
  },
  { key: "leads", name: "Prospects", category: "sector", sectorKeys: ["automobile"] },
  // Hôtellerie
  {
    key: "availability_calendar",
    name: "Calendrier de disponibilité",
    category: "sector",
    sectorKeys: ["hospitality"],
  },
  { key: "housekeeping", name: "Ménage", category: "sector", sectorKeys: ["hospitality"] },
  // Services
  {
    key: "service_catalog",
    name: "Catalogue de prestations",
    category: "sector",
    sectorKeys: ["services"],
  },
  {
    key: "appointments",
    name: "Rendez-vous",
    category: "sector",
    sectorKeys: ["services", "restaurant", "automobile", "hospitality"],
  },
  {
    key: "staff_availability",
    name: "Disponibilité des employés",
    category: "sector",
    sectorKeys: ["services"],
  },
  // Éducation
  { key: "courses", name: "Formations", category: "sector", sectorKeys: ["education"] },
  { key: "enrollments", name: "Inscriptions", category: "sector", sectorKeys: ["education"] },
  {
    key: "academic_tracking",
    name: "Suivi académique",
    category: "sector",
    sectorKeys: ["education"],
  },
  {
    key: "student_portal",
    name: "Portail étudiant",
    category: "sector",
    sectorKeys: ["education"],
  },
  { key: "parent_portal", name: "Portail parent", category: "sector", sectorKeys: ["education"] },
  // Livraison
  {
    key: "dispatch",
    name: "Répartition des courses",
    category: "sector",
    sectorKeys: ["delivery"],
  },
  {
    key: "deliverer_tracking",
    name: "Suivi livreur",
    category: "sector",
    sectorKeys: ["delivery"],
  },
  {
    key: "cod_reconciliation",
    name: "Réconciliation COD",
    category: "sector",
    sectorKeys: ["delivery"],
  },
  // Transverse
  {
    key: "regulated_documents",
    name: "Documents réglementés",
    category: "sector",
    sectorKeys: ["services", "ecommerce", "travel_agency"],
  },
];

async function seedSectorAndModuleRegistry() {
  for (const moduleDef of MODULES) {
    await prisma.module.upsert({
      where: { key: moduleDef.key },
      update: {
        name: moduleDef.name,
        category: moduleDef.category,
        sectorKeys: moduleDef.sectorKeys,
      },
      create: moduleDef,
    });
  }

  for (const sectorDef of SECTORS) {
    await prisma.sector.upsert({
      where: { key: sectorDef.key },
      update: { name: sectorDef.name, defaultModuleKeys: sectorDef.defaultModuleKeys },
      create: {
        key: sectorDef.key,
        name: sectorDef.name,
        defaultModuleKeys: sectorDef.defaultModuleKeys,
        isSystem: true,
      },
    });
  }
}

async function seedDemoTenant(input: {
  slug: string;
  name: string;
  businessType: "ECOMMERCE" | "AUTOMOBILE";
  sectorKey: string;
  ownerEmail: string;
  ownerName: string;
  planId: string;
  ownerRoleId: string;
  product: { name: string; price: number; sku: string };
  customer: { firstName: string; lastName: string; phone: string };
}) {
  // La création d'un tenant et son provisionnement initial (domaine, abonnement,
  // rattachement du propriétaire, moyens de paiement) sont des opérations Super Admin
  // par nature (voir docs/02-architecture-fonctionnelle.md §2.3) : sous Row-Level
  // Security, elles exigent donc explicitement un accès élevé — jamais le contexte
  // tenant par défaut, qui n'existe d'ailleurs pas encore puisque le tenant n'existe pas.
  const ownerUser = await prisma.user.upsert({
    where: { email: input.ownerEmail },
    update: {},
    create: {
      email: input.ownerEmail,
      fullName: input.ownerName,
      passwordHash: await hashPassword("Demo!2026"),
    },
  });

  const tenant = await withSuperAdminAccess(async (tx) => {
    const createdTenant = await tx.tenant.upsert({
      where: { slug: input.slug },
      update: {},
      create: {
        slug: input.slug,
        name: input.name,
        businessType: input.businessType,
        sectorKey: input.sectorKey,
        status: "ACTIVE",
        branding: { primaryColor: "#0F766E", secondaryColor: "#F59E0B", defaultMode: "light" },
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // Active les modules par défaut du secteur choisi — voir docs/11 §11.6.
    await activateSectorDefaults(tx, createdTenant.id, input.sectorKey);

    await tx.domain.upsert({
      where: { domain: `${input.slug}.yamacommerce.ai` },
      update: {},
      create: {
        tenantId: createdTenant.id,
        domain: `${input.slug}.yamacommerce.ai`,
        type: "subdomain",
        isPrimary: true,
        verified: true,
        sslStatus: "issued",
        dnsProvider: "caddy",
      },
    });

    await tx.subscription.upsert({
      where: { tenantId: createdTenant.id },
      update: {},
      create: {
        tenantId: createdTenant.id,
        planId: input.planId,
        status: "TRIALING",
        billingCycle: "monthly",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await tx.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: createdTenant.id, userId: ownerUser.id } },
      update: {},
      create: {
        tenantId: createdTenant.id,
        userId: ownerUser.id,
        roleId: input.ownerRoleId,
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    await tx.paymentProviderConfig.upsert({
      where: { tenantId_provider: { tenantId: createdTenant.id, provider: "cod" } },
      update: {},
      create: { tenantId: createdTenant.id, provider: "cod", isEnabled: true, mode: "sandbox" },
    });
    await tx.paymentProviderConfig.upsert({
      where: { tenantId_provider: { tenantId: createdTenant.id, provider: "paydunya" } },
      update: {},
      create: {
        tenantId: createdTenant.id,
        provider: "paydunya",
        isEnabled: false,
        mode: "sandbox",
      },
    });

    return createdTenant;
  });

  // Le reste des écritures scoped-tenant passe par withTenant() pour exercer, dès le
  // seed, le même chemin que le code applicatif (contexte RLS posé correctement).
  await withTenant(tenant.id, async (tx) => {
    const shop = await tx.shop.create({
      data: { tenantId: tenant.id, name: `${input.name} — Boutique principale`, isMain: true },
    });

    const category = await tx.category.create({
      data: { tenantId: tenant.id, name: "Général", slug: "general" },
    });

    const product = await tx.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        name: input.product.name,
        slug: input.product.sku.toLowerCase(),
        description: `${input.product.name} — produit de démonstration.`,
        shortDescription: input.product.name,
        sku: input.product.sku,
        status: "PUBLISHED",
        basePrice: input.product.price,
        tags: ["demo"],
      },
    });

    const variant = await tx.productVariant.create({
      data: {
        productId: product.id,
        name: "Standard",
        sku: `${input.product.sku}-STD`,
        price: input.product.price,
        attributes: {},
      },
    });

    await tx.inventoryItem.create({
      data: { productVariantId: variant.id, shopId: shop.id, quantity: 10, lowStockThreshold: 2 },
    });

    const customer = await tx.customer.create({
      data: {
        tenantId: tenant.id,
        firstName: input.customer.firstName,
        lastName: input.customer.lastName,
        phone: input.customer.phone,
        customerGroup: "retail",
      },
    });

    const fiscalYear = new Date().getFullYear();
    const orderSeq = await nextCounterValue(tx, tenant.id, `order-${fiscalYear}`);
    const order = await tx.order.create({
      data: {
        tenantId: tenant.id,
        shopId: shop.id,
        customerId: customer.id,
        orderNumber: formatOrderNumber(fiscalYear, orderSeq),
        status: "DELIVERED",
        channel: "web",
        paymentStatus: "PAID",
        subtotal: input.product.price,
        total: input.product.price,
        items: {
          create: {
            productVariantId: variant.id,
            productNameSnapshot: input.product.name,
            unitPrice: input.product.price,
            quantity: 1,
            total: input.product.price,
          },
        },
        statusHistory: {
          create: {
            toStatus: "DELIVERED",
            changedByType: "system",
            note: "Commande de démonstration",
          },
        },
      },
    });

    const payment = await tx.payment.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        provider: "cod",
        idempotencyKey: `seed-${order.id}`,
        amount: input.product.price,
        status: "SUCCEEDED",
        type: "full",
        verifiedAt: new Date(),
        reconciliationStatus: "matched",
        reconciledAt: new Date(),
      },
    });

    const invoiceSeq = await nextCounterValue(tx, tenant.id, `invoice-${fiscalYear}`);
    await tx.invoice.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        number: formatInvoiceNumber(fiscalYear, invoiceSeq),
        fiscalYear,
        type: "invoice",
        status: "finalized",
        customerSnapshot: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
        },
        itemsSnapshot: [
          {
            name: input.product.name,
            quantity: 1,
            unitPrice: input.product.price,
            total: input.product.price,
          },
        ],
        subtotal: input.product.price,
        taxTotal: 0,
        total: input.product.price,
        paymentStatus: "PAID",
        qrCodeToken: `seed-${order.id}-${payment.id}`,
        finalizedAt: new Date(),
      },
    });
  });

  console.info(`  ✓ Entreprise de démonstration "${input.name}" (${input.slug})`);
}

main()
  .catch((error) => {
    console.error("Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
