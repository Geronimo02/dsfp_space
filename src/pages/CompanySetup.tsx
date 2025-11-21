import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

export default function CompanySetup() {
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const navigate = useNavigate();
  const { userCompanies, loading: companyLoading } = useCompany();

  // Si el usuario ya tiene empresas, redirigir al dashboard para evitar crear otra.
  useEffect(() => {
    if (!companyLoading && userCompanies.length > 0) {
      toast.info("Ya tienes acceso a una empresa. Redirigiendo...");
      navigate("/");
    }
  }, [companyLoading, userCompanies, navigate]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      toast.error("El nombre de la empresa es requerido");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      // Use the security definer function to create company with admin
      const { data: company, error: companyError } = await supabase
        .rpc("create_company_with_admin" as any, {
          company_name: companyName,
          company_tax_id: taxId || null,
          company_phone: phone || null,
          company_address: address || null,
        });

      if (companyError) throw companyError;

      toast.success("Empresa creada exitosamente");
      
      // Wait a bit for company_users to be created, then redirect
      setTimeout(() => {
        navigate("/");
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast.error(error.message || "Error al crear la empresa");
    } finally {
      setLoading(false);
    }
  };

  if (companyLoading) {
    return <div className="flex items-center justify-center min-h-screen">Verificando empresas...</div>;
  }

  if (userCompanies.length > 0) {
    return <div className="flex items-center justify-center min-h-screen">Redirigiendo...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Configura tu empresa</CardTitle>
          <CardDescription>
            Para comenzar a usar el sistema, necesitas crear tu primera empresa.
            {userCompanies.length > 0 && (
              <span className="block mt-2 text-yellow-600">
                Ya tienes acceso a {userCompanies.length} empresa(s). Si necesitas crear otra empresa adicional, 
                puedes hacerlo desde Configuración (puede tener cargo adicional según tu plan).
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCompany} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nombre de la empresa *</Label>
              <Input
                id="companyName"
                placeholder="Mi Empresa S.A."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId">CUIT / RUC / Tax ID</Label>
              <Input
                id="taxId"
                placeholder="20-12345678-9"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                placeholder="+54 11 1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                placeholder="Av. Principal 123, Ciudad"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear empresa
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
            <p>
              ¿Ya tienes una empresa? Pide a un administrador que te invite a través de Empleados.
            </p>
            <p className="text-xs">
              Nota: Solo se permite una empresa por cuenta de forma gratuita. 
              Empresas adicionales pueden requerir actualización de plan.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
