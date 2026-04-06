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
    const logo = settings.theme_logo_url;

    // Title
    document.title = tagline ? `${name} — ${tagline}` : name;

    // Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", description);

    // OG tags
    const ensureOg = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    ensureOg("og:title", name);
    ensureOg("og:description", description);
    if (logo) ensureOg("og:image", logo);

    // Favicon
    if (favicon) {
      let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon;

      // Also set apple-touch-icon
      let appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      if (!appleLink) {
        appleLink = document.createElement("link");
        appleLink.rel = "apple-touch-icon";
        document.head.appendChild(appleLink);
      }
      appleLink.href = favicon;
    }
  }, [settings]);

  return null;
};

export default DynamicHead;
