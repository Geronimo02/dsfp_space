import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useEffect } from 'react';

export const useActiveModules = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['activeModules', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return [];
      }

      console.log('[useActiveModules] Fetching active modules for company:', currentCompany.id);

      const { data, error } = await supabase
        .from('company_modules')
        .select(`
          *,
          platform_modules(code)
        `)
        .eq('company_id', currentCompany.id)
        .eq('active', true);

      if (error) {
        console.error('[useActiveModules] Error fetching active modules:', error);
        throw error;
      }

      // Retornar array de códigos de módulos activos
      const modules = data?.map((cm: any) => cm.platform_modules?.code).filter(Boolean) || [];
      console.log('[useActiveModules] Active modules loaded:', modules);
      return modules;
    },
    enabled: !!currentCompany?.id,
    // Mantener datos frescos
    staleTime: 1000 * 5, // 5 segundos - más frecuente para cambios de admin
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Suscribirse a cambios en tiempo real de company_modules
  useEffect(() => {
    if (!currentCompany?.id) return;

    console.log('[useActiveModules] Setting up realtime subscription for company_modules:', currentCompany.id);

    const channel = supabase
      .channel(`company_modules_realtime_${currentCompany.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_modules',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        (payload) => {
          console.log('[useActiveModules] Realtime change detected:', payload);
          // Invalidar y refetch inmediatamente cuando hay cambios
          queryClient.invalidateQueries({ queryKey: ['activeModules', currentCompany.id] });
        }
      )
      .subscribe((status) => {
        console.log('[useActiveModules] Realtime subscription status:', status);
      });

    return () => {
      console.log('[useActiveModules] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);

  return query;
};
