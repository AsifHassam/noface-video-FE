import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = new Date("2026-04-05");
  const brandDeals = new Date("2026-04-06");
  return [
    {
      url: "https://noface.video/",
      lastModified: base,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://noface.video/blog",
      lastModified: base,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: "https://noface.video/blog/how-technerd-stewie-got-53800-followers-without-showing-his-face",
      lastModified: base,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: "https://noface.video/blog/how-to-start-a-faceless-youtube-channel-2026",
      lastModified: base,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: "https://noface.video/blog/how-faceless-creators-land-brand-deals-tiktok-instagram",
      lastModified: brandDeals,
      changeFrequency: "monthly",
      priority: 0.75,
    },
  ];
}
