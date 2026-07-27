"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function FacilitatorMessageNavigationRefresh({ shouldRefresh }: { shouldRefresh: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!shouldRefresh) return;

    router.refresh();
  }, [router, shouldRefresh]);

  return null;
}
