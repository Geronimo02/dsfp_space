import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface InvoiceVolumeTier {
  min: number;
  max: number | null;
  price: number;
}

export interface PricingConfig {
  id: string;
  base_package_price_monthly: number;
  base_package_price_annual: number;
  annual_discount_percentage: number;
  invoice_volume_tiers: InvoiceVolumeTier[];
  created_at: string;
  updated_at: string;
}

export interface PlatformModule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_annual: number;
  is_base_module: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyModule {
  id: string;
  company_id: string;
  module_id: string;
  active: boolean;
  activated_at: string;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
  module?: PlatformModule;
}

export interface PriceCalculation {
  total_price: number;
  base_price: number;
  modules_price: number;
  volume_price: number;
  breakdown: {
    base_price: number;
    modules_price: number;
    volume_price: number;
    total_price: number;
    billing_cycle: string;
    invoice_volume: number;
  };
}

// Hook para obtener la configuración de precios
export const usePricingConfig = () => {
  return useQuery({
    queryKey: ['pricingConfig'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_pricing_config')
        .select('*')
        .single();

      if (error) throw error;
      return {
        ...data,
        invoice_volume_tiers: data.invoice_volume_tiers as unknown as InvoiceVolumeTier[],
      } as PricingConfig;
    },
  });
};

// Hook para actualizar la configuración de precios
export const useUpdatePricingConfig = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (config: Partial<PricingConfig>) => {
      const updateData = {
        ...config,
        invoice_volume_tiers: config.invoice_volume_tiers as unknown as any,
      };
      
      const { data, error } = await supabase
        .from('platform_pricing_config')
        .update(updateData)
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricingConfig'] });
      toast({
        title: 'Configuración actualizada',
        description: 'Los precios se han actualizado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Hook para obtener todos los módulos
export const usePlatformModules = () => {
  return useQuery({
    queryKey: ['platformModules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_modules')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as PlatformModule[];
    },
  });
};

// Hook para crear/actualizar un módulo
export const useUpsertModule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (module: Partial<PlatformModule>) => {
      const { data, error } = await supabase
        .from('platform_modules')
        .upsert(module as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platformModules'] });
      toast({
        title: 'Módulo guardado',
        description: 'El módulo se ha guardado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Hook para eliminar un módulo
export const useDeleteModule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (moduleId: string) => {
      const { error } = await supabase
        .from('platform_modules')
        .delete()
        .eq('id', moduleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platformModules'] });
      toast({
        title: 'Módulo eliminado',
        description: 'El módulo se ha eliminado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Hook para obtener módulos de una empresa
export const useCompanyModules = (companyId: string | undefined) => {
  return useQuery({
    queryKey: ['companyModules', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('company_modules')
        .select(`
          *,
          platform_modules(*)
        `)
        .eq('company_id', companyId)
        .eq('active', true);

      if (error) throw error;
      return data as CompanyModule[];
    },
    enabled: !!companyId,
  });
};

// Hook para activar/desactivar módulos de una empresa
export const useToggleCompanyModule = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      companyId,
      moduleId,
      active,
    }: {
      companyId: string;
      moduleId: string;
      active: boolean;
    }) => {
      // Check if module already exists for this company
      const { data: existing, error: checkError } = await supabase
        .from('company_modules')
        .select('id')
        .eq('company_id', companyId)
        .eq('module_id', moduleId)
        .maybeSingle();

      let data;
      let error;

      if (existing) {
        // Update existing record
        const result = await supabase
          .from('company_modules')
          .update({
            active,
            activated_at: active ? new Date().toISOString() : undefined,
            deactivated_at: !active ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('company_id', companyId)
          .eq('module_id', moduleId)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      } else {
        // Insert new record
        const result = await supabase
          .from('company_modules')
          .insert({
            company_id: companyId,
            module_id: moduleId,
            active,
            activated_at: active ? new Date().toISOString() : null,
            deactivated_at: !active ? new Date().toISOString() : null,
          })
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['companyModules', variables.companyId] });
      toast({
        title: 'Módulo actualizado',
        description: 'El estado del módulo se ha actualizado correctamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

// Hook para calcular precio de suscripción
export const useCalculatePrice = () => {
  return useMutation({
    mutationFn: async ({
      companyId,
      billingCycle = 'monthly',
      invoiceVolume = 0,
    }: {
      companyId?: string;
      billingCycle?: 'monthly' | 'annual';
      invoiceVolume?: number;
    }) => {
      // Si no hay companyId, calculamos manualmente para el cotizador
      if (!companyId) {
        return {
          total_price: 0,
          base_price: 0,
          modules_price: 0,
          volume_price: 0,
          breakdown: {
            base_price: 0,
            modules_price: 0,
            volume_price: 0,
            total_price: 0,
            billing_cycle: billingCycle,
            invoice_volume: invoiceVolume,
          },
        } as PriceCalculation;
      }

      const { data, error } = await supabase.rpc('calculate_subscription_price', {
        p_company_id: companyId,
        p_billing_cycle: billingCycle,
        p_invoice_volume: invoiceVolume,
      });

      if (error) throw error;
      
      // La función devuelve TABLE, así que data es un array
      const resultArray = data as Array<{
        total_price: number;
        base_price: number;
        modules_price: number;
        volume_price: number;
        breakdown: any;
      }>;
      
      const result = resultArray && resultArray.length > 0 ? resultArray[0] : null;
      
      if (!result) {
        return {
          total_price: 0,
          base_price: 0,
          modules_price: 0,
          volume_price: 0,
          breakdown: {
            base_price: 0,
            modules_price: 0,
            volume_price: 0,
            total_price: 0,
            billing_cycle: billingCycle,
            invoice_volume: invoiceVolume,
          },
        } as PriceCalculation;
      }
      
      return {
        total_price: result.total_price || 0,
        base_price: result.base_price || 0,
        modules_price: result.modules_price || 0,
        volume_price: result.volume_price || 0,
        breakdown: result.breakdown || {
          base_price: 0,
          modules_price: 0,
          volume_price: 0,
          total_price: 0,
          billing_cycle: billingCycle,
          invoice_volume: invoiceVolume,
        },
      } as PriceCalculation;
    },
  });
};

// Hook para calcular precio manualmente (para cotizador)
export const useCalculatePriceManual = () => {
  const { data: config } = usePricingConfig();
  const { data: modules } = usePlatformModules();

  const calculatePrice = (
    selectedModuleIds: string[],
    billingCycle: 'monthly' | 'annual',
    invoiceVolume: number
  ): PriceCalculation => {
    console.log('🧮 calculatePrice called with:', { selectedModuleIds, billingCycle, invoiceVolume, hasConfig: !!config, hasModules: !!modules });
    
    if (!config || !modules) {
      console.warn('⚠️ Missing config or modules!', { config, modules });
      return {
        total_price: 0,
        base_price: 0,
        modules_price: 0,
        volume_price: 0,
        breakdown: {
          base_price: 0,
          modules_price: 0,
          volume_price: 0,
          total_price: 0,
          billing_cycle: billingCycle,
          invoice_volume: invoiceVolume,
        },
      };
    }

    // Precio base
    const basePrice =
      billingCycle === 'annual'
        ? config.base_package_price_annual
        : config.base_package_price_monthly;
    
    console.log('💰 Base price:', basePrice, 'from config:', config);

    // Precio de módulos adicionales (no base)
    const modulesPrice = selectedModuleIds.reduce((total, moduleId) => {
      const module = modules.find((m) => m.id === moduleId && !m.is_base_module);
      if (module) {
        const price =
          billingCycle === 'annual' ? module.price_annual : module.price_monthly;
        console.log(`  ➕ Adding module ${module.name}: ${price} (total so far: ${total + price})`);
        return total + price;
      }
      return total;
    }, 0);
    
    console.log('🔧 Total modules price:', modulesPrice);

    // Precio por volumen
    const volumeTier = config.invoice_volume_tiers.find(
      (tier) =>
        invoiceVolume >= tier.min && (tier.max === null || invoiceVolume <= tier.max)
    );
    const volumePrice = volumeTier ? volumeTier.price : 0;

    const totalPrice = basePrice + modulesPrice + volumePrice;

    return {
      total_price: totalPrice,
      base_price: basePrice,
      modules_price: modulesPrice,
      volume_price: volumePrice,
      breakdown: {
        base_price: basePrice,
        modules_price: modulesPrice,
        volume_price: volumePrice,
        total_price: totalPrice,
        billing_cycle: billingCycle,
        invoice_volume: invoiceVolume,
      },
    };
  };

  return { calculatePrice };
};
