"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eventReturnLabel, publicReturnLabel, safeEventReturnPath, safePublicReturnPath } from "@/lib/return-to";

type PublicReturnLinkProps = {
  className: string;
  currentPath: string;
  fallbackHref: string;
  fallbackLabel: string;
  includeAppReturnPaths?: boolean;
};

export function PublicReturnLink({ className, currentPath, fallbackHref, fallbackLabel, includeAppReturnPaths = false }: PublicReturnLinkProps) {
  const searchParams = useSearchParams();
  const rawReturnPath = includeAppReturnPaths ? searchParams.get("admin_return") ?? searchParams.get("return_to") : searchParams.get("return_to");
  const returnPath = includeAppReturnPaths ? safeEventReturnPath(rawReturnPath, currentPath) : safePublicReturnPath(rawReturnPath, currentPath);
  const href = returnPath ?? fallbackHref;
  const label = returnPath ? (includeAppReturnPaths ? eventReturnLabel(returnPath, fallbackLabel) : publicReturnLabel(returnPath, fallbackLabel)) : fallbackLabel;

  return (
    <Link className={className} href={href}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
