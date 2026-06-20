"use client";

import { useState } from "react";

export function SignupPhoneInput() {
  const [phone, setPhone] = useState("");

  function handleChange(value: string) {
    setPhone(value.replace(/\D/g, "").slice(0, 8));
  }

  return (
    <input
      autoComplete="tel"
      className="h-12 rounded-xl border border-[#7A4EAB]/15 bg-white px-4 text-base outline-none transition focus:border-[#7A4EAB]"
      inputMode="numeric"
      maxLength={8}
      name="phone"
      onChange={(event) => handleChange(event.currentTarget.value)}
      pattern="[0-9]{8}"
      placeholder="Kan udfyldes senere"
      title="Telefonnummer skal best\u00e5 af pr\u00e6cis 8 tal."
      type="text"
      value={phone}
    />
  );
}
