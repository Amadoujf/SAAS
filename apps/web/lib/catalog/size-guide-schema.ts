import { z } from "zod";

/** Corps accepté par l'API (bornes larges : la validation métier est dans le registre). */
export const guideSchema = z.object({
  name: z.string().max(200),
  columns: z.array(z.string().max(200)).max(12),
  rows: z.array(z.array(z.string().max(200)).max(12)).max(60),
  note: z.string().max(1000).nullable().optional(),
});

