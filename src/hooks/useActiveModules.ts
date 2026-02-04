import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useEffect } from 'react';

// Módulos base que siempre están activos para todas las empresas
const BASE_MODULES = ['dashboard', 'pos', 'sales', 'products', 'customers', 'settings'];

export const useActiveModules = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['activeModules', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return [...BASE_MODULES]; // Retornar base modules si no hay empresa
      }

      console.log('[useActiveModules] Fetching active modules for company:', currentCompany.id);

      const { data, error } = await supabase
        .from('company_modules')
        .select(`
          *,
          platform_modules(code, is_base)
        `)
        .eq('company_id', currentCompany.id)
        .eq('active', true);

      if (error) {
        console.error('[useActiveModules] Error fetching active modules:', error);
        throw error;
      }

      // Obtener códigos de módulos activos de la empresa
      const companyModules = data?.map((cm: any) => cm.platform_modules?.code).filter(Boolean) || [];
      
      // Combinar con módulos base (siempre activos)
      const allActiveModules = [...new Set([...BASE_MODULES, ...companyModules])];
      
      console.log('[useActiveModules] Active modules loaded:', allActiveModules);
      return allActiveModules;
    },
    enabled: !!currentCompany?.id,
    staleTime: 1000 * 5,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Suscribirse a cambios en tiempo real de company_modules
  useEffect(() => {
    if (!currentCompany?.id) return;

    if (import.meta.env.DEV) console.log('[useActiveModules] Setting up realtime subscription for company_modules:', currentCompany.id);

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
          if (import.meta.env.DEV) console.log('[useActiveModules] Realtime change detected:', payload);
          queryClient.invalidateQueries({ queryKey: ['activeModules', currentCompany.id] });
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) console.log('[useActiveModules] Realtime subscription status:', status);
      });

    return () => {
      if (import.meta.env.DEV) console.log('[useActiveModules] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);

  return query;
};
