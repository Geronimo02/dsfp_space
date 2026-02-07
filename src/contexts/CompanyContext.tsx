import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Company {
  id: string;
  name: string;
  tax_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  currency: string;
  active: boolean;
}

interface CompanyUser {
  id: string;
  company_id: string;
  user_id: string;
  role: 'admin' | 'manager' | 'accountant' | 'employee' | 'cashier' | 'viewer' | 'warehouse' | 'technician' | 'auditor' | 'platform_admin';
  active: boolean;
  companies: Company;
}

interface CompanyContextType {
  currentCompany: Company | null;
  currentCompanyRole: CompanyUser['role'] | null;
  userCompanies: CompanyUser[];
  loading: boolean;
  switchCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [userCompanies, setUserCompanies] = useState<CompanyUser[]>([]);
  const [currentCompanyRole, setCurrentCompanyRole] = useState<CompanyUser['role'] | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchUserCompanies = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.debug("No authenticated user found");
        setLoading(false);
        return;
      }

      logger.debug("Fetching companies for user:", user.id);

      const { data, error } = await supabase
        .from('company_users')
        .select(`
          id,
          company_id,
          user_id,
          role,
          active,
          companies (
            id,
            name,
            tax_id,
            address,
            phone,
            email,
            logo_url,
            currency,
            active
          )
        `)
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (error) {
        if (import.meta.env.DEV) console.error("Error fetching company_users:", error);
        throw error;
      }

      logger.debug("Companies fetched:", data?.length || 0, "companies");
      const companyUsers = data as CompanyUser[];
      setUserCompanies(companyUsers);

      // Set current company from localStorage or first company
      const savedCompanyId = localStorage.getItem('currentCompanyId');
      if (savedCompanyId) {
        const savedCompany = data?.find((cu) => cu.company_id === savedCompanyId);
        if (savedCompany) {
          setCurrentCompany(savedCompany.companies);
          setCurrentCompanyRole(savedCompany.role);
        } else {
          // Empresa guardada no pertenece al usuario actual - limpiar y usar primera empresa
          localStorage.removeItem('currentCompanyId');
          if (data && data.length > 0) {
            setCurrentCompany(data[0].companies);
            setCurrentCompanyRole((data[0] as CompanyUser).role);
            localStorage.setItem('currentCompanyId', data[0].company_id);
          }
        }
      } else if (data && data.length > 0) {
        setCurrentCompany(data[0].companies);
        setCurrentCompanyRole((data[0] as CompanyUser).role);
        localStorage.setItem('currentCompanyId', data[0].company_id);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching companies:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las empresas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    const setupSubscription = async () => {
      await fetchUserCompanies();

      // Check if component is still mounted
      if (!isMountedRef.current) return;

      // Get current user to filter subscription
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMountedRef.current) return;

      // Clean up old subscription if exists
      if (subscriptionRef.current) {
        await supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }

      // Subscribe to changes only for current user's company_users
      subscriptionRef.current = supabase
        .channel(`company_users_changes_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'company_users',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (isMountedRef.current) {
              fetchUserCompanies();
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, []);

  const switchCompany = (companyId: string) => {
    const company = userCompanies.find((cu) => cu.company_id === companyId);
    if (company) {
      setCurrentCompany(company.companies);
      setCurrentCompanyRole(company.role);
      localStorage.setItem('currentCompanyId', companyId);
      toast({
        title: 'Empresa cambiada',
        description: `Ahora estás trabajando en ${company.companies.name}`,
      });
      // Instead of reload, we'll let React Query handle the refresh
      // The currentCompany change will trigger re-renders and new queries
    } else {
      // Si la empresa no existe en la lista del usuario, limpiar localStorage
      localStorage.removeItem('currentCompanyId');
      toast({
        title: 'Error',
        description: 'No tienes acceso a esa empresa',
        variant: 'destructive',
      });
    }
  };

  const refreshCompanies = async () => {
    await fetchUserCompanies();
  };

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        currentCompanyRole,
        userCompanies,
        loading,
        switchCompany,
        refreshCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
