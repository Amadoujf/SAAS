import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { formatDateTime } from "@/lib/format";

/** Demandes de devis « Sur mesure » reçues depuis le site public — Super Admin uniquement. */
export default async function AdminInquiriesPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!session.user.isSuperAdmin) redirect("/dashboard");
  const inquiries = await withSuperAdminAccess((tx) => tx.platformInquiry.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-12">
      <Link href="/admin" className="text-sm underline">← Administration</Link>
      <h1 className="text-2xl font-semibold">Demandes de devis</h1>
      {inquiries.length === 0 ? (
        <p className="text-sm text-gray-600">Aucune demande pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {inquiries.map((q) => (
            <li key={q.id} className="rounded-lg border p-4 text-sm">
              <p className="font-semibold">{q.fullName}{q.companyName ? ` — ${q.companyName}` : ""} <span className="font-normal text-gray-500">· {formatDateTime(q.createdAt)} · {q.status}</span></p>
              <p className="text-gray-600">{q.email}{q.phone ? ` · ${q.phone}` : ""}{q.sectorKey ? ` · secteur ${q.sectorKey}` : ""}</p>
              <p className="mt-2 whitespace-pre-line">{q.message}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
