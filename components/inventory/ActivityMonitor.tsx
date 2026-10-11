"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordActivity } from "@/lib/inventory/activity";
export function ActivityMonitor() {
  const pathname = usePathname();
  useEffect(() => { void recordActivity("navigation", "success"); }, [pathname]);
  useEffect(() => {
    const failed = (event: ErrorEvent) => { void recordActivity("unexpected", "error", {}, event.error || new Error(event.message)); };
    const rejected = (event: PromiseRejectionEvent) => { void recordActivity("unexpected", "error", {}, event.reason); };
    window.addEventListener("error", failed); window.addEventListener("unhandledrejection", rejected);
    return () => { window.removeEventListener("error", failed); window.removeEventListener("unhandledrejection", rejected); };
  }, []);
  return null;
}
