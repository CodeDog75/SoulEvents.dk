"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { composeFullName } from "@/lib/auth/names";
import { getPostAuthRedirect, type PostAuthResult } from "@/lib/auth/post-auth";
import { env } from "@/lib/env";
import {
  assertPasswordResetRateLimit,
  assertRateLimit,
  isRateLimitExceededError,
  RATE_LIMIT_MESSAGE,
  type RateLimitAction,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

async function enforceAuthRateLimit(
  action: RateLimitAction,
  path: string,
  params?: Record<string, string>,
  message = RATE_LIMIT_MESSAGE,
) {
  try {
    await assertRateLimit(action);
  } catch (error) {
    if (isRateLimitExceededError(error)) {
      authRedirectWithParams(path, {
        ...(params ?? {}),
        message,
        status: "429",
      });
    }

    throw error;
  }
}

async function getRequestAppUrl() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  const requestOrigin = host ? `${proto}://${host}` : undefined;

  return getAppUrl(requestOrigin);
}

function getCanonicalAppUrl() {
  return (env.appUrl || "https://www.soulevents.dk").trim().replace(/\/$/, "");
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

export async function continueWithEmailAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();

  if (!email) {
    authRedirect("/auth/login", "Skriv din e-mailadresse for at fortsætte.");
  }

  await enforceAuthRateLimit(
    "auth:email-start",
    "/auth/login",
    undefined,
    "Der er foretaget mange forsøg på kort tid. Vent et øjeblik, og prøv igen.",
  );

  const existingUser = await getAuthUserByEmail(email);
  const step = existingUser ? "password" : "new";

  redirect(`/auth/login?step=${step}&email=${encodeURIComponent(email)}`);
}

export async function signInAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");

  if (!email || !password) {
    authRedirect("/auth/login", "Udfyld både e-mail og adgangskode.");
  }

  await enforceAuthRateLimit("auth:password-login", "/auth/login");

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

  let postAuthResult: PostAuthResult;

  try {
    postAuthResult = await getPostAuthRedirect({ email, user: data.user });
  } catch (error) {
    console.error("Password login profile preparation failed", {
      message: error instanceof Error ? error.message : "Unknown profile error",
    });
    authRedirect("/auth/login", "Login lykkedes, men profilen kunne ikke gøres klar.");
  }

  if (postAuthResult.type === "disabled") {
    await supabase.auth.signOut();
    authRedirect(postAuthResult.path, postAuthResult.message);
  }

  revalidatePath("/", "layout");
  redirect(postAuthResult.path);
}

export async function resendConfirmationAction(formData: FormData) {
  const email = getString(formData, "email").toLowerCase();

  if (!email) {
    authRedirectWithParams("/auth/login", {
      confirmation: "needed",
      message: "Skriv e-mailadressen, så sender vi en ny bekræftelsesmail.",
    });
  }

  await enforceAuthRateLimit("auth:resend-verification", "/auth/login", {
    confirmation: "needed",
    email,
  });

  const authUser = await getAuthUserByEmail(email);

  if (authUser?.email_confirmed_at) {
    authRedirect("/auth/login", "E-mailen er allerede bekræftet. Prøv at logge ind igen.");
  }

  const supabase = await createClient();
  const appUrl = await getRequestAppUrl();
  const { error } = await supabase.auth.resend({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
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

  try {
    await assertPasswordResetRateLimit(email);
  } catch (error) {
    if (isRateLimitExceededError(error)) {
      authRedirectWithParams("/auth/forgot-password", {
        message: RATE_LIMIT_MESSAGE,
        status: "429",
      });
    }

    throw error;
  }

  const supabase = await createClient();
  const appUrl = getCanonicalAppUrl();
  const redirectTo = `${appUrl}/auth/callback?next=/auth/update-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
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
  authRedirect("/auth/login", "Din adgangskode er blevet opdateret.");
}

export async function signUpFacilitatorAction(formData: FormData) {
  const firstName = getString(formData, "first_name");
  const lastName = getString(formData, "last_name");
  const legacyFullName = getString(formData, "full_name");
  const fullName = firstName && lastName ? composeFullName(firstName, lastName) : legacyFullName;
  const email = getString(formData, "email").toLowerCase();
  const phone = getString(formData, "phone");
  const password = getString(formData, "password");
  const successTarget = getString(formData, "success_target");
  const authReturnPath = getString(formData, "auth_return_path");
  const signupPath =
    authReturnPath === "email-first" && email
      ? `/auth/login?step=signup&email=${encodeURIComponent(email)}`
      : "/auth/signup";

  const phoneDigits = phone.replace(/\D/g, "");

  if ((!legacyFullName && (!firstName || !lastName)) || !email || !password) {
    authRedirect(signupPath, "Udfyld e-mail, adgangskode, fornavn og efternavn for at oprette profilen.");
  }

  if (phone && (!/^[\d\s]+$/.test(phone) || phoneDigits.length !== 8)) {
    authRedirect(signupPath, "Telefonnummer skal bestå af præcis 8 tal. Feltet kan også stå tomt.");
  }

  if (password.length < 8) {
    authRedirect(signupPath, "Adgangskoden skal være mindst 8 tegn.");
  }

  await enforceAuthRateLimit("auth:signup", signupPath);

  const existingUser = await getAuthUserByEmail(email);

  if (existingUser) {
    authRedirect(
      signupPath,
      "Der findes allerede en konto med denne e-mail. Log ind i stedet, eller brug Glemt adgangskode, hvis du ikke kan huske din adgangskode.",
    );
  }


  const supabase = await createClient();
  const appUrl = await getRequestAppUrl();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
      data: {
        first_name: firstName || undefined,
        full_name: fullName,
        last_name: lastName || undefined,
        role: "facilitator",
      },
    },
  });

  const user = data.user;

  if (error?.message.toLowerCase().includes("already registered")) {
    authRedirect(
      signupPath,
      "Der findes allerede en konto med denne e-mail. Log ind i stedet, eller brug Glemt adgangskode, hvis du ikke kan huske din adgangskode.",
    );
  }

  if (error) {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("rate limit")) {
      authRedirect(
        signupPath,
        "Der er sendt for mange mails på kort tid. Vent lidt og prøv igen, eller brug login hvis du allerede har oprettet en konto.",
      );
    }

    authRedirect(signupPath, "Oprettelsen kunne ikke gennemføres lige nu. Prøv igen om lidt.");
  }

  if (!user) {
    authRedirect(signupPath, "Oprettelse mislykkedes: Supabase returnerede ingen bruger.");
  }

  const admin = createAdminClient();
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
    authRedirect(signupPath, "Kontoen blev oprettet, men profilen kunne ikke gemmes.");
  }

  const { error: facilitatorError } = await admin.from("facilitator_profiles").upsert(
    {
      profile_id: user.id,
      status: "pending",
      company_name: null,
    },
    { onConflict: "profile_id" },
  );

  if (facilitatorError) {
    authRedirect(signupPath, "Kontoen blev oprettet, men arrangørprofilen kunne ikke gemmes.");
  }

  revalidatePath("/", "layout");

  if (successTarget === "signup") {
    redirect("/auth/signup?created=1");
  }

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
