// src/pages/AdminSubscriptionsAndBilling.tsx
import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, DollarSign, AlertTriangle } from "lucide-react";
import { SubscriptionAnalyticsDashboard } from "@/components/admin/SubscriptionAnalyticsDashboard";
import { InvoiceViewer } from "@/components/settings/InvoiceViewer";
import { TaxRatesManager } from "@/components/admin/TaxRatesManager";

export default function AdminSubscriptionsAndBilling() {
  const [activeTab, setActiveTab] = useState("analytics");

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Administración de Suscripciones y Facturación
          </h1>
          <p className="text-muted-foreground mt-2">Monitorea métricas de suscripciones, facturas y tasas de impuesto</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analítica
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Facturas
            </TabsTrigger>
            <TabsTrigger value="tax-rates" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Impuestos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
            <SubscriptionAnalyticsDashboard />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Gestión de Facturas
                </CardTitle>
                <CardDescription>
                  Ve todas las facturas emitidas. Las facturas se generan automáticamente en cada período de facturación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InvoiceViewer companyId={null} showAllCompanies={true} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax-rates" className="space-y-6">
            <TaxRatesManager />

            <Card className="shadow-soft border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-blue-900 dark:text-blue-100">Información sobre Tasas de Impuesto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                <p>
                  • Las tasas de impuesto se aplican automáticamente en las facturas basadas en el país del cliente
                </p>
                <p>
                  • Todas las facturas incluyen un desglose de impuestos (subtotal, impuesto, total)
                </p>
                <p>
                  • Los cambios en las tasas se aplican a las nuevas facturas generadas a partir del momento
                </p>
                <p>
                  • Tasas por defecto: Argentina 21%, Chile 19%, Colombia 19%, México 16%, Perú 18%, Uruguay 22%, USA 0%, GB 20%, Alemania 19%, España 21%
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
