// Types for Module Management System - Priority Features
// This file extends the auto-generated types from Supabase

import { Database } from './types';

// =====================================================
// Module Limits Structure
// =====================================================
export interface ModuleLimits {
  max_products?: number;
  max_users?: number;
  max_invoices_per_month?: number;
  max_storage_mb?: number;
  max_employees?: number;
  max_warehouses?: number;
  max_pos_points?: number;
  features?: string[]; // e.g., ["advanced_reports", "api_access", "export_excel"]
}

// =====================================================
// Module Dependencies Structure
// =====================================================
export interface ModuleDependencies {
  required_modules?: string[]; // Array of module codes that must be active
  incompatible_with?: string[]; // Array of module codes that cannot be active simultaneously
}

// =====================================================
// Module Status Types
// =====================================================
export type ModuleStatus = 'active' | 'suspended' | 'pending_payment' | 'trial' | 'expired';

export type ModuleChangeAction = 
  | 'activated' 
  | 'deactivated' 
  | 'upgraded' 
  | 'downgraded' 
  | 'trial_started' 
  | 'trial_ended';

export type AlertLevel = 'warning' | 'critical' | 'exceeded';

export type UsageType = 
  | 'products' 
  | 'invoices' 
  | 'users' 
  | 'storage' 
  | 'employees' 
  | 'warehouses'
  | 'pos_points';

// =====================================================
// Extended Platform Module Type
// =====================================================
export type PlatformModuleRow = Database['public']['Tables']['platform_modules']['Row'];
export type PlatformModuleInsertBase = Database['public']['Tables']['platform_modules']['Insert'];
export type PlatformModuleUpdateBase = Database['public']['Tables']['platform_modules']['Update'];

export interface PlatformModuleExtended extends Omit<PlatformModuleRow, 'limits' | 'dependencies'> {
  limits?: ModuleLimits;
  dependencies?: ModuleDependencies;
}

export interface PlatformModuleInsert extends Omit<PlatformModuleInsertBase, 'limits' | 'dependencies'> {
  limits?: ModuleLimits;
  dependencies?: ModuleDependencies;
}

export interface PlatformModuleUpdate extends Omit<PlatformModuleUpdateBase, 'limits' | 'dependencies'> {
  limits?: ModuleLimits;
  dependencies?: ModuleDependencies;
}

// =====================================================
// Extended Company Module Type
// =====================================================
export type CompanyModuleRow = Database['public']['Tables']['company_modules']['Row'];
export type CompanyModuleInsertBase = Database['public']['Tables']['company_modules']['Insert'];
export type CompanyModuleUpdateBase = Database['public']['Tables']['company_modules']['Update'];

export interface CompanyModuleExtended extends Omit<CompanyModuleRow, 'status' | 'is_trial' | 'trial_ends_at' | 'custom_limits'> {
  status?: ModuleStatus;
  is_trial?: boolean;
  trial_ends_at?: string | null;
  custom_limits?: ModuleLimits;
}

export interface CompanyModuleInsert extends Omit<CompanyModuleInsertBase, 'status' | 'is_trial' | 'trial_ends_at' | 'custom_limits'> {
  status?: ModuleStatus;
  is_trial?: boolean;
  trial_ends_at?: string | null;
  custom_limits?: ModuleLimits;
}

export interface CompanyModuleUpdate extends Omit<CompanyModuleUpdateBase, 'status' | 'is_trial' | 'trial_ends_at' | 'custom_limits'> {
  status?: ModuleStatus;
  is_trial?: boolean;
  trial_ends_at?: string | null;
  custom_limits?: ModuleLimits;
}

// =====================================================
// Module Change History Types
// =====================================================
export interface ModuleChangeHistory {
  id: number;
  company_id: string; // UUID
  module_id: string; // UUID
  action: ModuleChangeAction;
  changed_by: string | null; // UUID
  previous_price?: number | null;
  new_price?: number | null;
  reason?: string | null;
  metadata?: Record<string, any>;
  changed_at: string;
  created_at: string;
}

export interface ModuleChangeHistoryInsert {
  company_id: string; // UUID
  module_id: string; // UUID
  action: ModuleChangeAction;
  changed_by?: string | null;
  previous_price?: number | null;
  new_price?: number | null;
  reason?: string | null;
  metadata?: Record<string, any>;
}

// =====================================================
// Module Usage Stats Types
// =====================================================
export interface ModuleUsageStats {
  id: number;
  company_id: string; // UUID
  module_id: string; // UUID
  usage_type: UsageType;
  current_usage: number;
  limit_threshold: number | null;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

export interface ModuleUsageStatsInsert {
  company_id: string; // UUID
  module_id: string; // UUID
  usage_type: UsageType;
  current_usage?: number;
  limit_threshold?: number | null;
}

export interface ModuleUsageStatsUpdate {
  current_usage?: number;
  limit_threshold?: number | null;
  last_calculated_at?: string;
}

// =====================================================
// Module Usage Alerts Types
// =====================================================
export interface ModuleUsageAlert {
  id: number;
  company_id: string; // UUID
  module_id: string; // UUID
  usage_type: UsageType;
  current_usage: number;
  limit_threshold: number;
  alert_level: AlertLevel;
  alert_sent_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface ModuleUsageAlertInsert {
  company_id: string; // UUID
  module_id: string; // UUID
  usage_type: UsageType;
  current_usage: number;
  limit_threshold: number;
  alert_level: AlertLevel;
}

// =====================================================
// Composite Types for UI
// =====================================================

// Module with its current status and usage for a company
export interface CompanyModuleWithDetails extends CompanyModuleExtended {
  module: PlatformModuleExtended;
  usage_stats?: ModuleUsageStats[];
  active_alerts?: ModuleUsageAlert[];
  trial_days_remaining?: number;
  is_limit_exceeded?: boolean;
}

// Module change with related information
export interface ModuleChangeWithDetails extends ModuleChangeHistory {
  company_name?: string;
  module_name?: string;
  changed_by_name?: string;
  changed_by_email?: string;
}

// Usage alert with context
export interface ModuleUsageAlertWithDetails extends ModuleUsageAlert {
  company_name: string;
  module_name: string;
  percentage_used: number;
}

// =====================================================
// Utility Functions Types
// =====================================================

export interface ModuleActivationOptions {
  company_id: string; // UUID
  module_id: string; // UUID
  is_trial?: boolean;
  trial_days?: number;
  custom_limits?: ModuleLimits;
  reason?: string;
}

export interface ModuleDeactivationOptions {
  company_id: string; // UUID
  module_id: string; // UUID
  reason?: string;
  immediate?: boolean; // If false, waits until end of billing period
}

export interface ModuleUpgradeOptions {
  company_id: string; // UUID
  module_id: string; // UUID
  from_status: ModuleStatus;
  to_status: ModuleStatus;
  new_limits?: ModuleLimits;
  reason?: string;
}

// =====================================================
// Validation Result Types
// =====================================================

export interface ModuleDependencyValidation {
  valid: boolean;
  missing_modules?: string[];
  incompatible_modules?: string[];
  error_message?: string;
}

export interface ModuleLimitCheck {
  within_limit: boolean;
  usage_type: UsageType;
  current_usage: number;
  limit: number;
  percentage_used: number;
  alert_level?: AlertLevel;
}

export interface CompanyModuleLimits {
  module_code: string;
  module_name: string;
  limits: ModuleLimits;
  current_usage: Record<string, number>;
  limit_checks: ModuleLimitCheck[];
}

// =====================================================
// API Response Types
// =====================================================

export interface ModuleActivationResult {
  success: boolean;
  company_module?: CompanyModuleExtended;
  history_entry?: ModuleChangeHistory;
  error?: string;
  warnings?: string[];
}

export interface BulkModuleOperation {
  company_id: string; // UUID
  module_operations: Array<{
    module_id: string; // UUID
    action: 'activate' | 'deactivate' | 'upgrade';
    options?: Partial<ModuleActivationOptions>;
  }>;
}

export interface BulkModuleOperationResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    module_id: string; // UUID
    success: boolean;
    error?: string;
  }>;
}

// =====================================================
// Trial Management Types
// =====================================================

export interface TrialModuleConfig {
  default_trial_days: number;
  modules_with_trial: string[]; // Module codes that offer trial
  auto_convert_to_paid: boolean;
  grace_period_days: number;
}

export interface ExpiredTrialsSummary {
  total_expired: number;
  companies_affected: number;
  modules_affected: Array<{
    company_id: string; // UUID
    company_name: string;
    module_code: string;
    module_name: string;
    expired_at: string;
  }>;
}
