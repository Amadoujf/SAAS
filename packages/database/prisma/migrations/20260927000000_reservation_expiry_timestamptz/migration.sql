-- ============================================================================
-- Correction durable du bug de fuseau horaire sur l'expiration des réservations
-- (étape 2, revue post-M4, 20 septembre 2026).
--
-- `Order.reservationExpiresAt` était un `timestamp` SANS fuseau (comportement par
-- défaut de Prisma pour `DateTime`). `order-reservation.ts` le comparait à `NOW()`
-- (qui renvoie un `timestamptz`) via `"reservationExpiresAt" AT TIME ZONE 'UTC' <
-- NOW()` — un correctif fonctionnel mais fragile : toute AUTRE requête future contre
-- cette colonne (y compris une simple comparaison nue) aurait silencieusement
-- réinterprété ses chiffres nus dans le fuseau de LA SESSION Postgres courante,
-- reproduisant le même bug (confirmé en test réel : une réservation expirée depuis
-- plusieurs minutes restait invisible tant que la session était en
-- "America/New_York" plutôt qu'UTC).
--
-- Solution durable : la colonne devient `timestamptz` — elle stocke un instant
-- ABSOLU, comparable directement et sans ambiguïté à `NOW()` (également
-- `timestamptz`), quel que soit le fuseau de la session. `AT TIME ZONE 'UTC'` dans
-- le `USING` ci-dessous n'est PAS une double conversion : `reservationExpiresAt`
-- (timestamp nu) contient déjà des chiffres UTC (convention Prisma constante,
-- indépendante du fuseau de session, pour l'écriture d'un `DateTime` JS) — cette
-- clause dit simplement à Postgres "ces chiffres nus REPRÉSENTENT déjà l'UTC",
-- produisant le timestamptz correct SANS décalage. Une conversion implicite
-- (`::timestamptz` seul, sans `AT TIME ZONE`) aurait au contraire réinterprété ces
-- mêmes chiffres dans le fuseau de la session — exactement le bug qu'on corrige.
-- ============================================================================

ALTER TABLE "Order"
  ALTER COLUMN "reservationExpiresAt" TYPE TIMESTAMPTZ(3)
  USING ("reservationExpiresAt" AT TIME ZONE 'UTC');
