import { OpportunitiesList } from "@/components/crm/OpportunitiesList";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function Opportunities() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState("");
  if (!currentCompany) return null;
  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Oportunidades</h1>
        <Input
          placeholder="Buscar oportunidad o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
      </div>
      <OpportunitiesList companyId={currentCompany.id} search={search} />
    </Layout>
  );
}
