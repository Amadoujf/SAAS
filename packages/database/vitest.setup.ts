import { config } from "dotenv";
import { resolve } from "node:path";

// Charge le .env à la racine du monorepo pour que DATABASE_URL, MIGRATE_DATABASE_URL,
// et ENCRYPTION_KEY soient disponibles pendant les tests de ce package.
config({ path: resolve(__dirname, "../../.env") });
