"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export function UpdatePasswordForm() {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"error" | "success" | "">("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setStatus("");

    if (!password || !confirmPassword) {
      setMessage("Udfyld begge adgangskodefelter.");
      setStatus("error");
      return;
    }

    if (password.length < 8) {
      setMessage("Adgangskoden skal være mindst 8 tegn.");
      setStatus("error");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Adgangskoderne er ikke ens.");
      setStatus("error");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    console.info("Password reset form session check", {
      getSessionError: Boolean(sessionError),
      hasSession: Boolean(session),
    });
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (error) {
      setMessage("Adgangskoden kunne ikke opdateres: " + error.message);
      setStatus("error");
      return;
    }

    setConfirmPassword("");
    setPassword("");
    setMessage("Din adgangskode er blevet opdateret.");
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="mt-6 grid gap-4">
        <p className="rounded-md border border-sage-700/20 bg-sage-50 px-4 py-3 text-sm leading-6 text-sage-700">
          {message}
        </p>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700"
          href="/auth/login"
        >
          Log ind
        </Link>
      </div>
    );
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
      {message ? (
        <p
          className={
            "rounded-md border px-4 py-3 text-sm leading-6 " +
            (status === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-sage-700/20 bg-sage-50 text-sage-700")
          }
        >
          {message}
        </p>
      ) : null}

      <label className="grid gap-2 text-sm font-medium text-ink/72">
        Ny adgangskode
        <input
          autoComplete="new-password"
          className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-ink/72">
        Gentag adgangskode
        <input
          autoComplete="new-password"
          className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
          minLength={8}
          name="confirm_password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />
      </label>

      <button
        className="mt-2 h-11 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Gemmer..." : "Gem ny adgangskode"}
      </button>
    </form>
  );
}
