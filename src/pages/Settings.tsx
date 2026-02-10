import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign } from "lucide-react";

import { CompanySettings } from "@/components/settings/CompanySettings";
import { PriceListsSettings } from "@/components/settings/PriceListsSettings";
import { TicketDesignSettings } from "@/components/settings/TicketDesignSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";

export default function Settings() {
  return (
    <Layout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Configuración del Sistema</h1>
          <p className="text-sm text-muted-foreground">Administra todos los ajustes globales del sistema</p>
        </div>

        <Tabs defaultValue="company" className="w-full">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-5">
              <TabsTrigger value="company" className="text-xs sm:text-sm">Empresa</TabsTrigger>
              <TabsTrigger value="price-lists" className="text-xs sm:text-sm">Precios</TabsTrigger>
              <TabsTrigger value="ticket-design" className="text-xs sm:text-sm">Tickets</TabsTrigger>
              <TabsTrigger value="security" className="text-xs sm:text-sm">Seguridad</TabsTrigger>
              <TabsTrigger value="subscription" className="text-xs sm:text-sm">Suscripción</TabsTrigger>
            </TabsList>
          </div>

          {/* Company */}
          <TabsContent value="company">
            <CompanySettings />
          </TabsContent>

          {/* Price Lists */}
          <TabsContent value="price-lists">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Listas de Precios
                </CardTitle>
                <CardDescription>
                  Gestiona diferentes listas de precios para tus productos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PriceListsSettings />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ticket Design */}
          <TabsContent value="ticket-design" className="space-y-6">
            <TicketDesignSettings />
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-6">
            <SecuritySettings />
          </TabsContent>

          {/* Subscription */}
          <TabsContent value="subscription">
            <SubscriptionSettings />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
