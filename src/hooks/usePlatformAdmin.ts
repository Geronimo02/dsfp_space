import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const usePlatformAdmin = () => {
  const { data: isPlatformAdmin, isLoading } = useQuery({
    queryKey: ["platform-admin-status"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[usePlatformAdmin] user:", user);
      if (!user) return false;

      const { data, error } = await supabase
        .from("platform_admins")
        .select("active")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (error) {
        console.error("[usePlatformAdmin] Error checking platform admin:", error);
        return false;
      }
      console.log("[usePlatformAdmin] platform_admins data:", data);
      return !!data;
    },
  });

  useEffect(() => {
    console.log("[usePlatformAdmin] isPlatformAdmin:", isPlatformAdmin, "isLoading:", isLoading);
  }, [isPlatformAdmin, isLoading]);

  return {
    isPlatformAdmin: isPlatformAdmin ?? false,
    isLoading,
  };
};
