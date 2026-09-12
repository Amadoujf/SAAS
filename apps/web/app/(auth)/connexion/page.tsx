import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";

export default function ConnexionPage({ searchParams }: { searchParams: { error?: string } }) {
  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/connexion?error=1");
      }
      throw error;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">{t(DEFAULT_LOCALE, "auth.login.title")}</h1>

      {searchParams.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {t(DEFAULT_LOCALE, "auth.login.error")}
        </p>
      )}

      <form action={authenticate} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={t(DEFAULT_LOCALE, "auth.login.email")}
          className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder={t(DEFAULT_LOCALE, "auth.login.password")}
          className="rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2"
        />
        <button
          type="submit"
          className="bg-brand text-brand-foreground rounded-md px-4 py-2 font-medium transition hover:opacity-90"
        >
          {t(DEFAULT_LOCALE, "auth.login.submit")}
        </button>
      </form>
    </main>
  );
}
