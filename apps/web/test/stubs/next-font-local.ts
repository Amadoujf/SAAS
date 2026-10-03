/** Substitut de `next/font/local` pour Vitest : la vraie fonction n'existe qu'au build
 *  Next.js. Renvoie la même forme (classes et variable CSS), vides. */
export default function localFont() {
  return { className: "", variable: "", style: { fontFamily: "" } };
}
