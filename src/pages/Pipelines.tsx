import { Pipelines } from "@/components/crm/Pipelines";
import { useCompany } from "@/contexts/CompanyContext";

export default function PipelinesPage() {
  const { currentCompany } = useCompany();
  if (!currentCompany) return null;
  return <Pipelines companyId={currentCompany.id} />;
}
