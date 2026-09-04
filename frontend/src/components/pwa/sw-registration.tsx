"use client";

import { useEffect } from "react";

export function SWRegistration() {
  useEffect(() => {
    // Register only in production — a dev service worker interferes with HMR.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.log("SW registration failed:", err));
    }
  }, []);
  return null;
}