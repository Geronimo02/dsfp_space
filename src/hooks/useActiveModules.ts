import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';

export const useActiveModules = () => {
  const { currentCompany } = useCompany();

  return useQuery({
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
  });
};
