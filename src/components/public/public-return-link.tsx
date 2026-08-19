"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { publicReturnLabel, safePublicReturnPath } from "@/lib/return-to";

type PublicReturnLinkProps = {
  className: string;
  currentPath: string;
  fallbackHref: string;
  fallbackLabel: string;
};

export function PublicReturnLink({ className, currentPath, fallbackHref, fallbackLabel }: PublicReturnLinkProps) {
  const searchParams = useSearchParams();
  const returnPath = safePublicReturnPath(searchParams.get("return_to"), currentPath);
  const href = returnPath ?? fallbackHref;
  const label = returnPath ? publicReturnLabel(returnPath, fallbackLabel) : fallbackLabel;

  return (
    <Link className={className} href={href}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
