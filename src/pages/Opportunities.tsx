import { OpportunitiesList } from "@/components/crm/OpportunitiesList";
import { useCompany } from "@/contexts/CompanyContext";

export default function Opportunities() {
  const { currentCompany } = useCompany();
  if (!currentCompany) return null;
  return <OpportunitiesList companyId={currentCompany.id} />;
}
