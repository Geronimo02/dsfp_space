import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Settings, ShoppingCart, Store, FileText, BarChart3, Clock } from "lucide-react";

const Integrations = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ["integrations", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("integrations")
        .update({ active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integración actualizada");
    },
    onError: () => {
      toast.error("Error al actualizar la integración");
    },
  });

  const integrationTypes = [
    {
      type: "mercadolibre",
      name: "Mercado Libre",
      icon: ShoppingCart,
      description: "Sincroniza pedidos y genera facturas automáticamente",
      comingSoon: true,
    },
    {
      type: "tiendanube",
      name: "Tienda Nube",
      icon: Store,
      description: "Conecta tu tienda online con tu sistema",
      comingSoon: true,
    },
    {
      type: "woocommerce",
      name: "WooCommerce",
      icon: Store,
      description: "Integración con tu tienda WordPress",
      comingSoon: true,
    },
    {
      type: "google_forms",
      name: "Google Forms",
      icon: FileText,
      description: "Crea clientes y presupuestos desde formularios",
      comingSoon: true,
    },
  ];

  const getIntegrationStatus = (type: string) => {
    return integrations?.find((i) => i.integration_type === type);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Integraciones</h1>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted" />
                <CardContent className="h-32 bg-muted/50" />
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Integraciones</h1>
        </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrationTypes.map((integration) => {
          const status = getIntegrationStatus(integration.type);
          const Icon = integration.icon;

          return (
            <Card key={integration.type} className={integration.comingSoon ? "opacity-75" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {integration.name}
                        {integration.comingSoon && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Próximamente
                          </Badge>
                        )}
                      </CardTitle>
                      {status && !integration.comingSoon && (
                        <Badge variant={status.active ? "default" : "secondary"} className="mt-1">
                          {status.active ? "Activo" : "Inactivo"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {status && !integration.comingSoon && (
                    <Switch
                      checked={status.active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: status.id, active: checked })
                      }
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  {integration.description}
                </CardDescription>
                {integration.comingSoon ? (
                  <Button variant="outline" className="w-full" disabled>
                    <Clock className="mr-2 h-4 w-4" />
                    Disponible Pronto
                  </Button>
                ) : !status ? (
                  <Button variant="outline" className="w-full">
                    Configurar
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full" size="sm">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Ver Logs
                    </Button>
                    <Button variant="outline" className="w-full" size="sm">
                      <Settings className="mr-2 h-4 w-4" />
                      Configuración
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {integrations && integrations.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pedidos Sincronizados</CardTitle>
            <CardDescription>
              Últimos pedidos recibidos desde las integraciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground py-8">
              No hay pedidos sincronizados aún
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </Layout>
  );
};

export default Integrations;