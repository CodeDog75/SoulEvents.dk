"use client";

import { useEffect, useState } from "react";

function greetingForHour(hour: number) {
  if (hour >= 5 && hour <= 10) return "Godmorgen";
  if (hour === 11) return "God formiddag";
  if (hour >= 12 && hour <= 16) return "God eftermiddag";
  if (hour >= 17 && hour <= 23) return "God aften";
  return "God nat";
}

function preferredName(name: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) return "og velkommen";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function DashboardGreeting({ name }: { name: string | null }) {
  const [greeting, setGreeting] = useState("Velkommen tilbage");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setGreeting(greetingForHour(new Date().getHours()));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      {greeting}, {preferredName(name)} 🌿
    </>
  );
}
