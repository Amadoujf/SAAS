# Image unique de Y-COM (site/tableau de bord `web`, `worker` des notifications, tâche
# `migrate` de la base) — utilisée par la prévisualisation privée (infra/preview).
# Aucune clé ni valeur secrète n'est intégrée : tout vient des variables d'environnement
# au démarrage du conteneur.
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @yamacommerce/database exec prisma generate
# Valeurs FACTICES, seulement pour que la compilation charge les modules (aucune
# connexion n'est ouverte pendant la compilation) ; remplacées au démarrage.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build AUTH_SECRET=build-only-not-secret-0123456789abcdef \
    ENCRYPTION_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddee REDIS_URL=redis://localhost:6379 \
    pnpm --filter @yamacommerce/web exec next build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@yamacommerce/web", "exec", "next", "start", "-p", "3000"]
