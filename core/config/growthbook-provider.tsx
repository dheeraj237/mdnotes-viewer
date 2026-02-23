"use client";

import { ReactNode, useEffect } from "react";
import { features, setFeatureEnabled } from "@/core/config/features";

interface GrowthBookWrapperProps {
  children: ReactNode;
}

export function GrowthBookWrapper({ children }: GrowthBookWrapperProps) {
  useEffect(() => {
    // Determine env-specific GrowthBook variables (Vite exposes import.meta.env)
    const mode = import.meta.env.MODE;
    const host = mode === "production" ? import.meta.env.VITE_GROWTHBOOK_PROD_API_HOST : import.meta.env.VITE_GROWTHBOOK_DEV_API_HOST;
    const key = mode === "production" ? import.meta.env.VITE_GROWTHBOOK_PROD_CLIENT_KEY : import.meta.env.VITE_GROWTHBOOK_DEV_CLIENT_KEY;

    if (!host || !key) return;

    const fetchFlags = async () => {
      try {
        const url = `${host.replace(/\/$/, "")}/api/features/${key}`;
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) return;
        const json = await res.json();

        // GrowthBook CDN returns features under various shapes; be defensive
        const remoteFeatures = json?.features || json?.data?.features || json || {};

        // Map remote features to our local features by comparing IDs
        Object.keys(features).forEach((localKey) => {
          const local = features[localKey as keyof typeof features];
          const remoteEntry = remoteFeatures[local.id] ?? remoteFeatures[localKey] ?? null;

          if (remoteEntry != null) {
            // remoteEntry may be a boolean or an object with `enabled` property
            const enabled = typeof remoteEntry === "object" ? !!remoteEntry.enabled : !!remoteEntry;
            setFeatureEnabled(localKey as any, enabled);
          }
        });
      } catch (err) {
        // Fail silently - don't block app render
        // eslint-disable-next-line no-console
        console.debug("GrowthBook fetch failed:", err);
      }
    };

    fetchFlags();
  }, []);

  return <>{children}</>;
}
