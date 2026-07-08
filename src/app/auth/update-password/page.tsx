import Link from "next/link";
import { AuthMessage } from "@/components/auth/auth-message";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { BrandLogo } from "@/components/brand-logo";

type UpdatePasswordPageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const { message } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfaf7] px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
        <Link className="mb-8 flex items-center gap-3" href="/">
          <BrandLogo className="h-32 w-32" priority />
          <div>
            <p className="text-sm text-ink/65">Ny adgangskode</p>
          </div>
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-midnight">Vælg ny adgangskode</h1>
          <p className="text-sm leading-6 text-ink/65">
            Adgangskoden skal være mindst 8 tegn.
          </p>
        </div>

        <div className="mt-5">
          <AuthMessage message={message} />
        </div>

        <UpdatePasswordForm />
      </section>
    </main>
  );
}
