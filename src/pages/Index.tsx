import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { userCompanies, loading } = useCompany();

  useEffect(() => {
    if (!loading) {
      if (userCompanies.length === 0) {
        navigate("/company-setup");
      } else {
        navigate("/dashboard");
      }
    }
  }, [loading, userCompanies, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;
