import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePlatformAdmin = () => {
  const { data: isPlatformAdmin, isLoading } = useQuery({
    queryKey: ["platform-admin-status"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("platform_admins")
        .select("active")
        .eq("user_id", user.id)
        .eq("active", true)
        .single();

      if (error) return false;
      return !!data;
    },
  });

  return {
    isPlatformAdmin: isPlatformAdmin ?? false,
    isLoading,
  };
};
