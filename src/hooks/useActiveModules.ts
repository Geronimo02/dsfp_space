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

      const { data, error } = await supabase
        .from('company_modules')
        .select(`
          *,
          platform_modules(code)
        `)
        .eq('company_id', currentCompany.id)
        .eq('active', true);

      if (error) throw error;

      // Retornar array de códigos de módulos activos
      return data?.map((cm: any) => cm.platform_modules?.code).filter(Boolean) || [];
    },
    enabled: !!currentCompany?.id,
    // Mantener datos frescos
    staleTime: 1000 * 30, // 30 segundos
  });

  // Suscribirse a cambios en tiempo real de company_modules
  useEffect(() => {
    if (!currentCompany?.id) return;

    const channel = supabase
      .channel(`company_modules_${currentCompany.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_modules',
          filter: `company_id=eq.${currentCompany.id}`,
        },
        () => {
          // Invalidar y refetch cuando hay cambios
          queryClient.invalidateQueries({ queryKey: ['activeModules', currentCompany.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);

  return query;
};
