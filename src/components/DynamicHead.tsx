import { useEffect } from "react";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

const DynamicHead = () => {
  const { data: settings } = usePlatformSettings();

  useEffect(() => {
    if (!settings) return;

    const name = settings.theme_website_name || "MayaX";
    const tagline = settings.theme_tagline || "";
    const description = settings.theme_meta_description || "";
    const favicon = settings.theme_favicon_url;

    // Title
    document.title = tagline ? `${name} — ${tagline}` : name;

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);

    // OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", name);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", description);

    // Favicon
    if (favicon) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
  }, [settings]);

  return null;
};

export default DynamicHead;
