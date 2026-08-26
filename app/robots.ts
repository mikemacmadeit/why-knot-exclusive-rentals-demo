import type { MetadataRoute } from "next";
import { getSiteBaseUrl } from "@/config/site";
import { shouldBlockSearchIndexing } from "@/lib/seo/block-search-indexing";

const baseUrl = getSiteBaseUrl();

export default function robots(): MetadataRoute.Robots {
  if (shouldBlockSearchIndexing()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/booking/cancel",
        "/booking/manage/",
        "/booking/success",
        "/waiver/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
