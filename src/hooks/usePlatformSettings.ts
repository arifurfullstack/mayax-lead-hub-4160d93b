import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlatformSettings = Record<string, string>;

export const usePlatformSettings = () => {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: async (): Promise<PlatformSettings> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value");
      if (error) throw error;
      const settings: PlatformSettings = {};
      data?.forEach((row: any) => {
        settings[row.key] = row.value ?? "";
      });
      return settings;
    },
    staleTime: 5 * 60 * 1000,
  });
};
