import { Layout } from "@/components/layout/Layout";
import { EmployeeSelfTimeTracking } from "@/components/employees/EmployeeSelfTimeTracking";

export default function MyTimeTracking() {
  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-4xl">
        <EmployeeSelfTimeTracking />
      </div>
    </Layout>
  );
}
