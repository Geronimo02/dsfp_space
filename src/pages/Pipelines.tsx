import { Pipelines } from "@/components/crm/Pipelines";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";

export default function PipelinesPage() {
  const { currentCompany } = useCompany();
  if (!currentCompany) return null;
  return (
    <Layout>
      <Pipelines companyId={currentCompany.id} />
    </Layout>
  );
}
