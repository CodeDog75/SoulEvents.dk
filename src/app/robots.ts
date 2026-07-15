import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/open-graph";

function publicSiteUrl() {
  if (process.env.NODE_ENV === "production") return "https://www.soulevents.dk";
  return siteBaseUrl();
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = publicSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/bliv-arrangoer", "/categories/", "/events/", "/facilitators/", "/inspiration/", "/legal/", "/privacy", "/terms"],
      disallow: ["/admin/", "/api/", "/auth/", "/dashboard/", "/facilitator/", "/ads/"],
    },
    sitemap: baseUrl + "/sitemap.xml",
  };
}
