// Helper functions for Module Management System
import { supabase } from './client';
import {
  ModuleActivationOptions,
  ModuleDeactivationOptions,
  ModuleUpgradeOptions,
  ModuleActivationResult,
  ModuleDependencyValidation,
  ModuleLimitCheck,
  CompanyModuleLimits,
  ModuleChangeHistory,
  ModuleUsageStats,
  ModuleUsageAlert,
  CompanyModuleWithDetails,
  PlatformModuleExtended,
  ModuleLimits,
  UsageType,
  ExpiredTrialsSummary,
} from './types.modules';

// =====================================================
// Module Activation / Deactivation
// =====================================================

/**
 * Activate a module for a company with optional trial period
 */
export async function activateModule(
  options: ModuleActivationOptions
): Promise<ModuleActivationResult> {
  try {
    const { company_id, module_id, is_trial = false, trial_days = 30, custom_limits, reason } = options;

    // Calculate trial end date if applicable
    const trial_ends_at = is_trial
      ? new Date(Date.now() + trial_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Check if module already exists for this company
    const { data: existing, error: checkError } = await supabase
      .from('company_modules')
      .select('id')
      .eq('company_id', company_id)
      .eq('module_id', module_id)
      .maybeSingle();

    let companyModule;
    let moduleError;

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('company_modules')
        .update({
          active: true,
          status: is_trial ? 'trial' : 'active',
          is_trial,
          trial_ends_at,
          custom_limits: custom_limits as any || {},
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', company_id)
        .eq('module_id', module_id)
        .select()
        .single();
      
      companyModule = data;
      moduleError = error;
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('company_modules')
        .insert({
          company_id: company_id,
          module_id: module_id,
          active: true,
          status: is_trial ? 'trial' : 'active',
          is_trial,
          trial_ends_at,
          custom_limits: custom_limits as any || {},
          activated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      companyModule = data;
      moduleError = error;
    }

    if (moduleError) {
      return {
        success: false,
        error: moduleError.message,
      };
    }

    return {
      success: true,
      company_module: companyModule as any,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Deactivate a module for a company
 */
export async function deactivateModule(
  options: ModuleDeactivationOptions
): Promise<ModuleActivationResult> {
  try {
    const { company_id, module_id, reason, immediate = true } = options;

    const updateData: any = {
      active: false,
      status: 'suspended',
      deactivated_at: new Date().toISOString(),
    };

    const { data: companyModule, error: moduleError } = await supabase
      .from('company_modules')
      .update(updateData)
      .eq('company_id', company_id.toString())
      .eq('module_id', module_id.toString())
      .select()
      .single();

    if (moduleError) {
      return {
        success: false,
        error: moduleError.message,
      };
    }

    return {
      success: true,
      company_module: companyModule as any,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upgrade a module (e.g., from trial to paid)
 */
export async function upgradeModule(
  options: ModuleUpgradeOptions
): Promise<ModuleActivationResult> {
  try {
    const { company_id, module_id, to_status, new_limits } = options;

    const updateData: any = {
      status: to_status,
      is_trial: to_status === 'trial',
      trial_ends_at: to_status === 'trial' ? null : undefined,
    };

    if (new_limits) {
      updateData.custom_limits = new_limits as any;
    }

    const { data: companyModule, error: moduleError } = await supabase
      .from('company_modules')
      .update(updateData)
      .eq('company_id', company_id)
      .eq('module_id', module_id)
      .select()
      .single();

    if (moduleError) {
      return {
        success: false,
        error: moduleError.message,
      };
    }

    return {
      success: true,
      company_module: companyModule as any,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// Module Dependencies Validation
// =====================================================

/**
 * Validate if a module can be activated based on its dependencies
 */
export async function validateModuleDependencies(
  companyId: string,
  moduleId: string
): Promise<ModuleDependencyValidation> {
  try {
    // Get module with dependencies
    const { data: module, error: moduleError } = await supabase
      .from('platform_modules')
      .select('dependencies')
      .eq('id', moduleId)
      .single();

    if (moduleError || !module) {
      return {
        valid: false,
        error_message: 'Module not found',
      };
    }

    const dependencies = module.dependencies as any;
    
    if (!dependencies || Object.keys(dependencies).length === 0) {
      return { valid: true };
    }

    // Check required modules
    if (dependencies.required_modules && dependencies.required_modules.length > 0) {
      const { data: activeModules, error: activeMError } = await supabase
        .from('company_modules')
        .select('module:platform_modules(code)')
        .eq('company_id', companyId)
        .eq('active', true)
        .eq('status', 'active');

      if (activeMError) {
        return {
          valid: false,
          error_message: 'Error checking active modules',
        };
      }

      const activeCodes = activeModules?.map((m: any) => m.module?.code).filter(Boolean) || [];
      const missingModules = dependencies.required_modules.filter(
        (code: string) => !activeCodes.includes(code)
      );

      if (missingModules.length > 0) {
        return {
          valid: false,
          missing_modules: missingModules,
          error_message: `Required modules not active: ${missingModules.join(', ')}`,
        };
      }
    }

    // Check incompatible modules
    if (dependencies.incompatible_with && dependencies.incompatible_with.length > 0) {
      const { data: activeModules, error: activeMError } = await supabase
        .from('company_modules')
        .select('module:platform_modules(code)')
        .eq('company_id', companyId)
        .eq('active', true);

      if (activeMError) {
        return {
          valid: false,
          error_message: 'Error checking active modules',
        };
      }

      const activeCodes = activeModules?.map((m: any) => m.module?.code).filter(Boolean) || [];
      const incompatibleActive = dependencies.incompatible_with.filter(
        (code: string) => activeCodes.includes(code)
      );

      if (incompatibleActive.length > 0) {
        return {
          valid: false,
          incompatible_modules: incompatibleActive,
          error_message: `Incompatible modules are active: ${incompatibleActive.join(', ')}`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// Module Usage and Limits
// =====================================================

/**
 * Get current usage stats for a company's module
 */
export async function getModuleUsageStats(
  companyId: string,
  moduleId: string
): Promise<ModuleUsageStats[]> {
  const { data, error } = await supabase
    .from('module_usage_stats')
    .select('*')
    .eq('company_id', companyId)
    .eq('module_id', moduleId);

  if (error) throw error;
  return (data || []) as ModuleUsageStats[];
}

/**
 * Update usage stats for a module
 */
export async function updateModuleUsage(
  companyId: string,
  moduleId: string,
  usageType: UsageType,
  currentUsage: number
): Promise<void> {
  const { error } = await supabase
    .from('module_usage_stats')
    .upsert({
      company_id: companyId,
      module_id: moduleId,
      usage_type: usageType,
      current_usage: currentUsage,
      last_calculated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

/**
 * Check if company is within module limits
 */
export async function checkModuleLimits(
  companyId: string,
  moduleId: string
): Promise<ModuleLimitCheck[]> {
  try {
    // Get module limits
    const { data: module, error: moduleError } = await supabase
      .from('platform_modules')
      .select('limits')
      .eq('id', moduleId)
      .single();

    if (moduleError || !module) return [];

    const limits = (module.limits as ModuleLimits) || {};

    // Get company module custom limits
    const { data: companyModule, error: cmError } = await supabase
      .from('company_modules')
      .select('custom_limits')
      .eq('company_id', companyId)
      .eq('module_id', moduleId)
      .single();

    const customLimits = (companyModule?.custom_limits as any as ModuleLimits) || {};
    const effectiveLimits = { ...limits, ...customLimits };

    // Get usage stats
    const usageStats = await getModuleUsageStats(companyId, moduleId);

    // Build limit checks
    const checks: ModuleLimitCheck[] = [];

    for (const stat of usageStats) {
      const limitKey = `max_${stat.usage_type}` as keyof ModuleLimits;
      const limit = effectiveLimits[limitKey] as number | undefined;

      if (limit !== undefined) {
        const percentageUsed = (stat.current_usage / limit) * 100;
        const withinLimit = stat.current_usage <= limit;

        let alertLevel: 'warning' | 'critical' | 'exceeded' | undefined;
        if (percentageUsed >= 100) alertLevel = 'exceeded';
        else if (percentageUsed >= 90) alertLevel = 'critical';
        else if (percentageUsed >= 80) alertLevel = 'warning';

        checks.push({
          within_limit: withinLimit,
          usage_type: stat.usage_type as UsageType,
          current_usage: stat.current_usage,
          limit,
          percentage_used: percentageUsed,
          alert_level: alertLevel,
        });
      }
    }

    return checks;
  } catch (error) {
    console.error('Error checking module limits:', error);
    return [];
  }
}

/**
 * Get all module limits and usage for a company
 */
export async function getCompanyModuleLimits(
  companyId: string
): Promise<CompanyModuleLimits[]> {
  try {
    const { data: companyModules, error } = await supabase
      .from('company_modules')
      .select(`
        *,
        module:platform_modules(*)
      `)
      .eq('company_id', companyId)
      .eq('active', true);

    if (error) throw error;

    const result: CompanyModuleLimits[] = [];

    for (const cm of companyModules || []) {
      const module = cm.module as any;
      if (!module) continue;

      const limitChecks = await checkModuleLimits(companyId, cm.module_id);
      const usageStats = await getModuleUsageStats(companyId, cm.module_id);

      const currentUsage: Record<string, number> = {};
      usageStats.forEach(stat => {
        currentUsage[stat.usage_type] = stat.current_usage;
      });

      result.push({
        module_code: module.code,
        module_name: module.name,
        limits: { ...(module.limits as any || {}), ...(cm.custom_limits as any || {}) },
        current_usage: currentUsage,
        limit_checks: limitChecks,
      });
    }

    return result;
  } catch (error) {
    console.error('Error getting company module limits:', error);
    return [];
  }
}

// =====================================================
// Module Change History
// =====================================================

/**
 * Get module change history for a company
 */
export async function getModuleChangeHistory(
  companyId: string,
  limit: number = 50
): Promise<ModuleChangeHistory[]> {
  const { data, error } = await supabase
    .from('module_change_history')
    .select('*')
    .eq('company_id', companyId)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as ModuleChangeHistory[];
}

/**
 * Get all module changes across all companies (admin only)
 */
export async function getAllModuleChangeHistory(
  limit: number = 100
): Promise<ModuleChangeHistory[]> {
  const { data, error } = await supabase
    .from('module_change_history')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as ModuleChangeHistory[];
}

// =====================================================
// Module Alerts
// =====================================================

/**
 * Create a usage alert
 */
export async function createModuleAlert(
  companyId: string,
  moduleId: string,
  usageType: UsageType,
  currentUsage: number,
  limitThreshold: number,
  alertLevel: 'warning' | 'critical' | 'exceeded'
): Promise<void> {
  const { error } = await supabase
    .from('module_usage_alerts')
    .insert({
      company_id: companyId,
      module_id: moduleId,
      usage_type: usageType,
      current_usage: currentUsage,
      limit_threshold: limitThreshold,
      alert_level: alertLevel,
    });

  if (error) throw error;
}

/**
 * Get active alerts for a company
 */
export async function getActiveAlerts(companyId: string): Promise<ModuleUsageAlert[]> {
  const { data, error } = await supabase
    .from('module_usage_alerts')
    .select('*')
    .eq('company_id', companyId)
    .is('resolved_at', null)
    .order('alert_sent_at', { ascending: false });

  if (error) throw error;
  return (data || []) as ModuleUsageAlert[];
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: number): Promise<void> {
  const { error } = await supabase
    .from('module_usage_alerts')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', alertId);

  if (error) throw error;
}

// =====================================================
// Trial Management
// =====================================================

/**
 * Get companies with modules in trial
 */
export async function getTrialModules(): Promise<CompanyModuleWithDetails[]> {
  const { data, error } = await supabase
    .from('company_modules')
    .select(`
      *,
      module:platform_modules(*)
    `)
    .eq('is_trial', true)
    .eq('status', 'trial')
    .not('trial_ends_at', 'is', null);

  if (error) throw error;

  return (data || []).map(cm => {
    const trialEndsAt = cm.trial_ends_at ? new Date(cm.trial_ends_at) : null;
    const now = new Date();
    const trialDaysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      ...cm,
      module: cm.module as any,
      trial_days_remaining: trialDaysRemaining,
    } as CompanyModuleWithDetails;
  });
}

/**
 * Expire trial modules (called by cron job)
 */
export async function expireTrialModules(): Promise<ExpiredTrialsSummary> {
  const { data, error } = await supabase.rpc('expire_trial_modules');

  if (error) throw error;

  // Get details of expired modules
  const { data: expiredModules, error: expiredError } = await supabase
    .from('company_modules')
    .select(`
      company_id,
      module:platform_modules(code, name),
      trial_ends_at,
      companies(name)
    `)
    .eq('status', 'expired')
    .eq('is_trial', true)
    .order('trial_ends_at', { ascending: false });

  if (expiredError) throw expiredError;

  const companies = new Set((expiredModules || []).map(m => m.company_id));

  return {
    total_expired: data || 0,
    companies_affected: companies.size,
    modules_affected: (expiredModules || []).map((m: any) => ({
      company_id: m.company_id,
      company_name: m.companies?.name || 'Unknown',
      module_code: m.module?.code || 'unknown',
      module_name: m.module?.name || 'Unknown',
      expired_at: m.trial_ends_at,
    })),
  };
}

/**
 * Convert trial to paid module
 */
export async function convertTrialToPaid(
  companyId: string,
  moduleId: string
): Promise<ModuleActivationResult> {
  return upgradeModule({
    company_id: companyId,
    module_id: moduleId,
    from_status: 'trial',
    to_status: 'active',
  });
}
