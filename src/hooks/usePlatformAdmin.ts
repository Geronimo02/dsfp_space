import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export const usePlatformAdmin = () => {
  const { data: isPlatformAdmin, isLoading, error } = useQuery({
    queryKey: ["platform-admin-status"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("platform_admins")
        .select("active")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (error) {
        logger.error("[usePlatformAdmin] Error checking platform admin:", error);
        throw error; // Propagate to React Query so callers can handle it
      }
      return !!data;
    },
  });

  return {
    isPlatformAdmin: isPlatformAdmin ?? false,
    isLoading,
    error,
  };
};
