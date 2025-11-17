import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  role: 'admin' | 'manager' | 'accountant' | 'employee' | 'cashier' | 'viewer' | 'warehouse' | 'technician' | 'auditor';
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

  const fetchUserCompanies = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

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

      if (error) throw error;

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
      console.error('Error fetching companies:', error);
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
    fetchUserCompanies();

    // Subscribe to changes in company_users
    const subscription = supabase
      .channel('company_users_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_users',
        },
        () => {
          fetchUserCompanies();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
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
      // Reload page to refresh all data and clear cache
      window.location.reload();
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
