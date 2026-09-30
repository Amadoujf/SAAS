-- Encaissements manuels : une seule liste de moyens de paiement pour tous les secteurs.
-- Aucune ligne n'est supprimée ; « card » (restaurant) devient « card_terminal »
-- (même sens : paiement par carte sur le terminal de l'entreprise).
UPDATE "RestaurantPayment" SET "method" = 'card_terminal' WHERE "method" = 'card';

ALTER TABLE "RestaurantPayment" DROP CONSTRAINT "RestaurantPayment_check";
ALTER TABLE "RestaurantPayment" ADD CONSTRAINT "RestaurantPayment_amount_check" CHECK ("amount" > 0);
ALTER TABLE "RestaurantPayment" ADD CONSTRAINT "RestaurantPayment_method_check" CHECK ("method" IN ('cash', 'wave', 'orange_money', 'free_money', 'bank_transfer', 'card_terminal', 'other'));
ALTER TABLE "RestaurantPayment" ADD CONSTRAINT "RestaurantPayment_void_check" CHECK (("voidedAt" IS NULL AND "voidReason" IS NULL) OR ("voidedAt" IS NOT NULL AND length(trim("voidReason")) > 0));

ALTER TABLE "ReservationPayment" DROP CONSTRAINT "ReservationPayment_method_check";
ALTER TABLE "ReservationPayment" ADD CONSTRAINT "ReservationPayment_method_check" CHECK ("method" IN ('cash', 'wave', 'orange_money', 'free_money', 'bank_transfer', 'card_terminal', 'other'));
