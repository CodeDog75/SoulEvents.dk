"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function authRedirect(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function authRedirectWithParams(path: string, params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`${path}?${searchParams.toString()}`);
}

async function getAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    return null;
  }

  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureStoredUserProfile(user: {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    role?: string;
  };
}) {
  const admin = createAdminClient();
  const { data: existingProfile } = await admin.from("profiles").select("id, role").eq("id", user.id).maybeSingle();
  const role = (user.user_metadata?.role === "admin" ? "admin" : "facilitator") satisfies AppRole;

  if (!existingProfile) {
    const { error: profileError } = await admin.from("profiles").insert({
      id: user.id,
      role,
      full_name: user.user_metadata?.full_name || user.email || "Bruger",
      email: user.email || "",
      phone: null,
    });

    if (profileError) {
      return profileError;
    }
  }

  const profileRole = (existingProfile?.role ?? role) as AppRole;

  if (profileRole === "facilitator") {
    const { data: existingFacilitatorProfile, error: lookupError } = await admin
      .from("facilitator_profiles")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (lookupError) {
      return lookupError;
    }

    const { error: facilitatorError } = existingFacilitatorProfile
      ? { error: null }
      : await admin.from("facilitator_profiles").insert({
          profile_id: user.id,
          status: "pending",
        });

    if (facilitatorError) {
      return facilitatorError;
    }
  }

  return null;
}

export async function signInAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");

  if (!email || !password) {
    authRedirect("/auth/login", "Udfyld både e-mail og adgangskode.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const errorMessage = error?.message.toLowerCase() ?? "";

  if (errorMessage.includes("email not confirmed") || errorMessage.includes("not confirmed")) {
    authRedirectWithParams("/auth/login", {
      confirmation: "needed",
      email,
      message: "E-mailen er ikke bekræftet endnu. Klik på linket i bekræftelsesmailen, og prøv derefter at logge ind igen. Du kan også få tilsendt en ny bekræftelsesmail herunder.",
    });
  }

  if (error || !data.user) {
    if (errorMessage.includes("invalid login credentials")) {
      const authUser = await getAuthUserByEmail(email);

      if (authUser && !authUser.email_confirmed_at) {
        authRedirectWithParams("/auth/login", {
          confirmation: "needed",
          email,
          message: "Kontoen findes, men e-mailen er ikke bekræftet endnu. Klik på linket i bekræftelsesmailen først, eller send en ny bekræftelsesmail herunder.",
        });
      }
    }

    authRedirect("/auth/login", "Login mislykkedes. Tjek e-mail og adgangskode.");
  }

  const profileError = await ensureStoredUserProfile(data.user);

  if (profileError) {
    authRedirect("/auth/login", "Login lykkedes, men profilen kunne ikke gøres klar.");
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resendConfirmationAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();

  if (!email) {
    authRedirectWithParams("/auth/login", {
      confirmation: "needed",
      message: "Skriv e-mailadressen, så sender vi en ny bekræftelsesmail.",
    });
  }

  const authUser = await getAuthUserByEmail(email);

  if (authUser?.email_confirmed_at) {
    authRedirect("/auth/login", "E-mailen er allerede bekræftet. Prøv at logge ind igen.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    email,
    options: {
      emailRedirectTo: `${env.appUrl || "http://localhost:3001"}/auth/callback`,
    },
    type: "signup",
  });

  if (error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("rate limit")) {
      authRedirectWithParams("/auth/login", {
        confirmation: "needed",
        email,
        message: "Der er sendt for mange bekræftelsesmails på kort tid. Vent lidt og prøv igen.",
      });
    }

    authRedirectWithParams("/auth/login", {
      confirmation: "needed",
      email,
      message: "Ny bekræftelsesmail kunne ikke sendes lige nu. Tjek e-mailadressen og prøv igen.",
    });
  }

  authRedirectWithParams("/auth/login", {
    email,
    message: "Ny bekræftelsesmail er sendt. Tjek indbakken og spam/reklame.",
  });
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();

  if (!email) {
    authRedirect("/auth/forgot-password", "Skriv din e-mailadresse.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: (env.appUrl || "http://localhost:3001") + "/auth/callback?next=/auth/update-password",
  });

  if (error) {
    authRedirect("/auth/forgot-password", "Link til ny adgangskode kunne ikke sendes: " + error.message);
  }

  authRedirect(
    "/auth/forgot-password",
    "Hvis e-mailen findes i systemet, har vi sendt et link til ny adgangskode. Tjek også spam/reklame.",
  );
}

export async function updatePasswordAction(formData: FormData) {
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirm_password");

  if (!password || !confirmPassword) {
    authRedirect("/auth/update-password", "Udfyld begge adgangskodefelter.");
  }

  if (password.length < 8) {
    authRedirect("/auth/update-password", "Adgangskoden skal være mindst 8 tegn.");
  }

  if (password !== confirmPassword) {
    authRedirect("/auth/update-password", "Adgangskoderne er ikke ens.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    authRedirect("/auth/update-password", "Adgangskoden kunne ikke opdateres: " + error.message);
  }

  revalidatePath("/", "layout");
  authRedirect("/auth/login", "Adgangskoden er opdateret. Du kan logge ind nu.");
}

export async function signUpFacilitatorAction(formData: FormData) {
  const fullName = getString(formData, "full_name");
  const email = getString(formData, "email").toLowerCase();
  const phone = getString(formData, "phone");
  const password = getString(formData, "password");
  const acceptedTerms = formData.get("accepted_terms") === "on";

  const phoneDigits = phone.replace(/\D/g, "");

  if (!fullName || !email || !password) {
    authRedirect("/auth/signup", "Udfyld e-mail, adgangskode og dit rigtige navn for at oprette profilen.");
  }

  if (phone && (!/^[\d\s]+$/.test(phone) || phoneDigits.length !== 8)) {
    authRedirect("/auth/signup", "Telefonnummer skal bestå af præcis 8 tal. Feltet kan også stå tomt.");
  }

  if (password.length < 8) {
    authRedirect("/auth/signup", "Adgangskoden skal være mindst 8 tegn.");
  }

  if (!acceptedTerms) {
    authRedirect("/auth/signup", "Du skal acceptere betingelserne for at fortsætte.");
  }
  const existingUser = await getAuthUserByEmail(email);

  if (existingUser) {
    authRedirect(
      "/auth/signup",
      "Der findes allerede en konto med denne e-mail. Log ind i stedet, eller brug Glemt adgangskode, hvis du ikke kan huske din adgangskode.",
    );
  }


  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${env.appUrl || "http://localhost:3001"}/auth/callback`,
      data: {
        full_name: fullName,
        role: "facilitator",
      },
    },
  });

  const user = data.user;

  if (error?.message.toLowerCase().includes("already registered")) {
    authRedirect(
      "/auth/signup",
      "Der findes allerede en konto med denne e-mail. Log ind i stedet, eller brug Glemt adgangskode, hvis du ikke kan huske din adgangskode.",
    );
  }

  if (error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("rate limit")) {
      authRedirect(
        "/auth/signup",
        "Der er sendt for mange mails på kort tid. Vent lidt og prøv igen, eller brug login hvis du allerede har oprettet en konto.",
      );
    }

    authRedirect("/auth/signup", "Oprettelsen kunne ikke gennemføres lige nu. Prøv igen om lidt.");
  }

  if (!user) {
    authRedirect("/auth/signup", "Oprettelse mislykkedes: Supabase returnerede ingen bruger.");
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      role: "facilitator",
      full_name: fullName,
      email,
      phone: phone || null,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    authRedirect("/auth/signup", "Kontoen blev oprettet, men profilen kunne ikke gemmes.");
  }

  const { error: facilitatorError } = await admin.from("facilitator_profiles").upsert(
    {
      profile_id: user.id,
      status: "pending",
      company_name: null,
      accepted_terms_at: now,
      accepted_privacy_at: now,
      accepted_guidelines_at: now,
    },
    { onConflict: "profile_id" },
  );

  if (facilitatorError) {
    authRedirect("/auth/signup", "Kontoen blev oprettet, men arrangørprofilen kunne ikke gemmes.");
  }

  revalidatePath("/", "layout");
  authRedirect(
    "/auth/login",
    "Din konto er oprettet. Tjek din indbakke og bekræft e-mailen via linket. Tjek også spam/reklame. Når e-mailen er bekræftet, kan du logge ind, færdiggøre profilen og oprette dit første event, mens vi gennemgår arrangørprofilen.",
  );
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}
