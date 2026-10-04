-- Ordre de saisie des lignes d'une commande de restaurant (lecture en cuisine).
ALTER TABLE "RestaurantOrderItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
