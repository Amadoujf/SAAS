#!/bin/sh
# Initialise la base SÉPARÉE de la prévisualisation : migrations, mot de passe du rôle
# applicatif (jamais la valeur par défaut), données de base, entreprises fictives.
set -e
cd "$(dirname "$0")/../../packages/database"
pnpm exec prisma migrate deploy
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } } });
const pw = process.env.DATABASE_URL.match(/yamacommerce_app:([^@]+)@/)[1];
p.\$executeRawUnsafe('ALTER ROLE yamacommerce_app PASSWORD ' + \"'\" + pw.replace(/'/g, \"''\") + \"'\").then(() => p.\$disconnect());
"
pnpm exec tsx src/seed.ts
for demo in commerce fashion real-estate travel salon hotel restaurant auto education courier; do
  echo "Démonstration : $demo"
  pnpm exec tsx "src/seed-$demo-demo.ts"
done
# Entreprises de TEST du banc d'essai IA (infra/preview/ai-trial) : jamais les démos.
FASHION_SEED=test pnpm exec tsx src/seed-fashion-demo.ts
AI_SEED=test pnpm exec tsx src/seed-ai-demo.ts
RESTO_SEED=test pnpm exec tsx src/seed-restaurant-demo.ts
AUTO_SEED=test pnpm exec tsx src/seed-auto-demo.ts
EDU_SEED=test pnpm exec tsx src/seed-education-demo.ts
pnpm exec tsx src/preview-demo-passwords.ts
echo "Base de prévisualisation prête."
