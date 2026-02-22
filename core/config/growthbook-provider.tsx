"use client";

import { GrowthBook, GrowthBookProvider } from "@growthbook/growthbook-react";
import { useEffect } from "react";

// Initialize GrowthBook instance
const growthbook = new GrowthBook({
  apiHost: process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST || "https://cdn.growthbook.io",
  clientKey: process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY || "",
  enableDevMode: process.env.NODE_ENV === "development",
  trackingCallback: (experiment, result) => {
    // Optional: Send experiment data to analytics
    console.log("Experiment viewed:", {
      experimentId: experiment.key,
      variationId: result.variationId,
    });
  },
});

interface GrowthBookWrapperProps {
  children: React.ReactNode;
}

export function GrowthBookWrapper({ children }: GrowthBookWrapperProps) {
  useEffect(() => {
    // Load features from GrowthBook API
    growthbook.loadFeatures({ autoRefresh: true });
  }, []);

  return <GrowthBookProvider growthbook={growthbook}>{children}</GrowthBookProvider>;
}

export { growthbook };
