# 10. Structure des dossiers du projet

Monorepo **pnpm workspaces + Turborepo**, pour partager la logique métier (paiements, permissions, PDF, IA, notifications) entre l'application web et le worker de jobs asynchrones sans duplication.

```
yamacommerce-ai/
├── apps/
│   ├── web/                        # Application Next.js (App Router) — public + dashboard + super admin
│   │   ├── app/
│   │   │   ├── (public)/           # Site vitrine du tenant, résolu par domaine
│   │   │   │   ├── [...catalogue routes]
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/        # Espace commerçant, protégé
│   │   │   │   ├── dashboard/
│   │   │   │   └── layout.tsx
│   │   │   ├── (admin)/            # Espace Super Admin, sous-domaine admin.
│   │   │   │   ├── admin/
│   │   │   │   └── layout.tsx
│   │   │   ├── api/
│   │   │   │   ├── v1/             # API stable, réutilisable par la future app mobile
│   │   │   │   └── webhooks/
│   │   │   │       ├── paydunya/route.ts
│   │   │   │       └── paytech/route.ts
│   │   │   └── middleware.ts       # Résolution tenant par domaine + auth guard
│   │   ├── components/             # Composants spécifiques à l'app web
│   │   ├── lib/                    # Glue applicative (server actions, hooks)
│   │   ├── public/
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── worker/                     # Worker BullMQ (emails, factures, IA, imports, webhooks)
│       ├── src/
│       │   ├── queues/
│       │   │   ├── emails.queue.ts
│       │   │   ├── invoices.queue.ts
│       │   │   ├── ai-jobs.queue.ts
│       │   │   ├── imports.queue.ts
│       │   │   ├── webhooks-payments.queue.ts
│       │   │   └── notifications.queue.ts
│       │   ├── processors/
│       │   └── index.ts
│       └── package.json
│
├── packages/
│   ├── database/                   # Prisma schema, client, migrations, seed, middleware tenant/RLS
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── tenant-context.ts   # pose app.current_tenant_id
│   │   │   └── counters.ts
│   │   └── package.json
│   │
│   ├── ui/                         # Design system partagé (shadcn/ui + composants YamaCommerce)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── theme/              # tokens clair/sombre, thème par tenant
│   │   │   └── charts/             # cartes stat, graphiques interactifs
│   │   └── package.json
│   │
│   ├── auth/                       # Auth.js config, RBAC, permissions, impersonation
│   │   └── src/
│   │       ├── permissions.ts      # catalogue des clés de permission (voir 05)
│   │       └── guards.ts
│   │
│   ├── payments/                   # Adaptateurs de paiement
│   │   └── src/
│   │       ├── provider.interface.ts
│   │       ├── paydunya.adapter.ts
│   │       ├── paytech.adapter.ts
│   │       ├── cod.adapter.ts
│   │       └── idempotency.ts
│   │
│   ├── documents/                  # Génération PDF (factures, devis, bons, avoirs) + QR code
│   │   └── src/
│   │       ├── invoice.template.tsx
│   │       ├── quote.template.tsx
│   │       └── render.ts
│   │
│   ├── notifications/              # Templates email/SMS/WhatsApp + envoi
│   │   └── src/
│   │       ├── channels/
│   │       │   ├── email.ts
│   │       │   ├── sms.ts
│   │       │   └── whatsapp.ts
│   │       └── templates/
│   │
│   ├── ai/                         # Abstraction fournisseur IA + prompts + pipeline produit
│   │   └── src/
│   │       ├── provider.interface.ts
│   │       ├── product-assistant.ts
│   │       ├── chat-agent.ts       # function calling sur les données tenant
│   │       └── translation.ts
│   │
│   ├── shared/                     # Types, schémas Zod, constantes partagées front/back
│   │   └── src/
│   │       ├── schemas/
│   │       └── types/
│   │
│   └── config/                     # Config partagée : eslint, tsconfig, tailwind
│       ├── eslint-preset.js
│       ├── tsconfig.base.json
│       └── tailwind-preset.ts
│
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.web
│   │   └── Dockerfile.worker
│   ├── docker-compose.yml          # postgres, redis, web, worker (dev)
│   └── Caddyfile                   # TLS automatique multi-domaine
│
├── docs/                           # Ce dossier (conception)
│
├── .env.example                    # Toutes les variables documentées, jamais de valeur réelle
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Conventions

- **Alias de package** : `@yamacommerce/database`, `@yamacommerce/ui`, `@yamacommerce/payments`, etc. — pas d'import relatif profond entre packages.
- **Aucune logique métier dans `apps/web/app`** au-delà de l'orchestration HTTP/rendu : la logique vit dans les packages, testable indépendamment de Next.js.
- **Secrets** : un seul fichier `.env.example` à la racine documente toutes les variables (`DATABASE_URL`, `REDIS_URL`, `PAYDUNYA_MASTER_KEY`, `PAYTECH_API_KEY`, `RESEND_API_KEY`, `WHATSAPP_CLOUD_TOKEN`, `AI_PROVIDER_API_KEY`, `R2_ACCESS_KEY_ID`, etc.) ; chaque environnement (dev/staging/prod) a son propre `.env` non versionné.
- **Tests** : `*.test.ts` colocalisés avec le code dans chaque package (Vitest) ; `apps/web/e2e/` pour les parcours Playwright (achat, paiement test, génération de facture).
