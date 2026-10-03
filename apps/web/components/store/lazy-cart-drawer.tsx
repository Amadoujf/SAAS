"use client";

import dynamic from "next/dynamic";

/** Le tiroir (et framer-motion) est chargé APRÈS l'affichage de la page : il ne pèse
 *  pas sur le premier rendu d'une boutique consultée en 3G/4G. */
export const LazyCartDrawer = dynamic(() => import("./cart-drawer").then((m) => m.CartDrawer), { ssr: false });
