import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useSSEStream } from "@/hooks/useSSEStream";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Search, 
  Lightbulb, 
  BarChart, 
  Loader2, 
  TrendingUp, 
  Package, 
  Users, 
  DollarSign,
  AlertTriangle,
  Target,
  StopCircle,
  Briefcase,
  Landmark,
  CreditCard,
  ShoppingCart,
  Headphones
} from "lucide-react";
import { toast } from "sonner";

type AnalysisType = "search" | "suggestion" | "report" | "stock-analysis" | "sales-prediction" | "customer-insights" | "financial-summary" | "hr-analysis" | "treasury" | "crm-pipeline" | "accounts-analysis" | "procurement" | "support-analysis";

export const AIAssistant = () => {
  const { currentCompany } = useCompany();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<AnalysisType>("search");

  const { text: response, isStreaming, error: streamError, startStream, stopStream } = useSSEStream({
    onComplete: (fullText) => {
      console.log("Streaming completado:", fullText.length, "caracteres");
    },
    onError: (error) => {
      toast.error(error || "Error al procesar tu consulta");
    },
  });

  const handleQuery = async (customQuery?: string, customType?: AnalysisType) => {
    const finalQuery = customQuery || query;
    const finalType = customType || activeTab;
    
    if (!finalQuery.trim()) {
      toast.error("Por favor ingresa una consulta");
      return;
    }

    if (isStreaming) {
      stopStream();
      return;
    }

    await startStream("ai-assistant-stream", {
      query: finalQuery,
      type: finalType,
      companyId: currentCompany?.id,
      context: finalType === "report" ? finalQuery : undefined,
    });
  };

  const quickActions = [
    {
      icon: Package,
      label: "Stock Crítico",
      description: "Productos que necesitan reposición",
      type: "stock-analysis" as AnalysisType,
      query: "Identifica productos con stock crítico y recomienda cantidades a reponer",
      color: "text-orange-500",
    },
    {
      icon: TrendingUp,
      label: "Predicción Ventas",
      description: "Proyección para la próxima semana",
      type: "sales-prediction" as AnalysisType,
      query: "Predice las ventas de la próxima semana basándote en el historial reciente",
      color: "text-blue-500",
    },
    {
      icon: Users,
      label: "Clientes VIP",
      description: "Top clientes y en riesgo",
      type: "customer-insights" as AnalysisType,
      query: "Muestra mis mejores clientes y aquellos en riesgo de abandono",
      color: "text-purple-500",
    },
    {
      icon: DollarSign,
      label: "Resumen Financiero",
      description: "Balance del mes actual",
      type: "financial-summary" as AnalysisType,
      query: "Dame un resumen financiero completo del mes actual con recomendaciones",
      color: "text-green-500",
    },
    {
      icon: AlertTriangle,
      label: "Alertas de Negocio",
      description: "Problemas a atender",
      type: "search" as AnalysisType,
      query: "¿Qué problemas urgentes debo atender en mi negocio hoy?",
      color: "text-red-500",
    },
    {
      icon: Target,
      label: "Oportunidades",
      description: "Sugerencias para crecer",
      type: "suggestion" as AnalysisType,
      query: "Dame 5 oportunidades concretas para aumentar las ventas esta semana",
      color: "text-emerald-500",
    },
    {
      icon: Briefcase,
      label: "RRHH",
      description: "Empleados y comisiones",
      type: "hr-analysis" as AnalysisType,
      query: "Analiza mi equipo: dotación, comisiones, horas y costo laboral",
      color: "text-indigo-500",
    },
    {
      icon: Landmark,
      label: "Tesorería",
      description: "Bancos, cheques, tarjetas",
      type: "treasury" as AnalysisType,
      query: "Dame el estado de tesorería: saldos, cheques pendientes y tarjetas por acreditar",
      color: "text-cyan-500",
    },
    {
      icon: Target,
      label: "CRM Pipeline",
      description: "Oportunidades y conversión",
      type: "crm-pipeline" as AnalysisType,
      query: "Analiza mi pipeline comercial: oportunidades abiertas, valor ponderado y tasa de conversión",
      color: "text-pink-500",
    },
    {
      icon: CreditCard,
      label: "Cuenta Cte",
      description: "Cobros y vencimientos",
      type: "accounts-analysis" as AnalysisType,
      query: "Analiza mi cuenta corriente: cobros, vencimientos pendientes y notas de crédito",
      color: "text-amber-500",
    },
    {
      icon: ShoppingCart,
      label: "Compras",
      description: "Órdenes y costos detalle",
      type: "procurement" as AnalysisType,
      query: "Analiza mis compras: órdenes abiertas, productos más comprados y costos",
      color: "text-teal-500",
    },
    {
      icon: Headphones,
      label: "Soporte",
      description: "Tickets y SLA",
      type: "support-analysis" as AnalysisType,
      query: "Analiza mis tickets de soporte: abiertos, SLA y prioridades",
      color: "text-rose-500",
    },
  ];

  const exampleQueries: Record<AnalysisType, string[]> = {
    search: [
      "Mostrame las ventas del mes pasado de cemento",
      "¿Cuáles son los productos más vendidos?",
      "Ventas de la última semana",
    ],
    suggestion: [
      "Dame sugerencias para mejorar las ventas",
      "¿Qué productos debería comprar más?",
      "Analiza mi stock actual",
    ],
    report: [
      "Explica por qué bajaron las ventas este mes",
      "Compara las ventas de este mes con el anterior",
      "Analiza tendencias de productos",
    ],
    "stock-analysis": [
      "¿Qué productos necesito reponer urgentemente?",
      "Productos sin movimiento en 30 días",
      "Calcula días de stock para cada producto",
    ],
    "sales-prediction": [
      "Predice ventas de la próxima semana",
      "¿Cuál es mi mejor día de ventas?",
      "Proyección de ingresos del mes",
    ],
    "customer-insights": [
      "Top 10 clientes por compras",
      "Clientes que no compran hace 60 días",
      "¿Quiénes tienen deuda pendiente?",
    ],
    "financial-summary": [
      "Resumen de ingresos y gastos del mes",
      "¿Cuál es mi margen de ganancia?",
      "Análisis de cuentas por cobrar",
    ],
    "hr-analysis": [
      "¿Cuántos empleados activos tengo?",
      "¿Cuánto pagué en comisiones?",
      "Resumen de horas trabajadas y productividad",
    ],
    "treasury": [
      "¿Cuánto tengo en cuentas bancarias?",
      "¿Qué cheques tengo pendientes?",
      "¿Cuánto espero cobrar por tarjetas?",
    ],
    "crm-pipeline": [
      "¿Cuántas oportunidades abiertas tengo?",
      "¿Cuál es el valor ponderado del pipeline?",
      "Tasa de conversión de oportunidades",
    ],
    "accounts-analysis": [
      "¿Cuántos movimientos vencidos tengo?",
      "Notas de crédito activas con saldo",
      "Principales deudores de cuenta corriente",
    ],
    "procurement": [
      "¿Cuántas órdenes de compra abiertas tengo?",
      "Productos más comprados por costo",
      "Costo total de compras del trimestre",
    ],
    "support-analysis": [
      "¿Cuántos tickets abiertos tengo?",
      "¿Se cumplen los SLA de respuesta?",
      "Tickets de alta prioridad pendientes",
    ],
  };

  const tabConfig = [
    { value: "search", icon: Search, label: "Búsqueda" },
    { value: "suggestion", icon: Lightbulb, label: "Sugerencias" },
    { value: "report", icon: BarChart, label: "Análisis" },
    { value: "stock-analysis", icon: Package, label: "Stock" },
    { value: "sales-prediction", icon: TrendingUp, label: "Predicción" },
    { value: "customer-insights", icon: Users, label: "Clientes" },
    { value: "financial-summary", icon: DollarSign, label: "Finanzas" },
    { value: "hr-analysis", icon: Briefcase, label: "RRHH" },
    { value: "treasury", icon: Landmark, label: "Tesorería" },
    { value: "crm-pipeline", icon: Target, label: "CRM" },
    { value: "accounts-analysis", icon: CreditCard, label: "Cta Cte" },
    { value: "procurement", icon: ShoppingCart, label: "Compras" },
    { value: "support-analysis", icon: Headphones, label: "Soporte" },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Asistente IA Avanzado</CardTitle>
        </div>
        <CardDescription>
          Análisis predictivo, insights de clientes y recomendaciones inteligentes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Actions Grid */}
        <div>
          <label className="text-sm font-medium mb-3 block">Análisis Rápidos</label>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-accent"
                onClick={() => {
                  setQuery(action.query);
                  setActiveTab(action.type);
                  handleQuery(action.query, action.type);
                }}
                disabled={isStreaming}
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-medium">{action.label}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {action.description}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AnalysisType)}>
          <TabsList className="grid w-full" style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}>
            {tabConfig.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1 text-xs px-1">
                <tab.icon className="h-3 w-3" />
                <span className="hidden lg:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tu consulta</label>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Escribe tu pregunta o selecciona un análisis rápido..."
                  onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                  className="flex-1"
                />
                <Button onClick={() => handleQuery()} disabled={isStreaming}>
                  {isStreaming ? (
                    <>
                      <StopCircle className="h-4 w-4 mr-2" />
                      Detener
                    </>
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ejemplos:</label>
              <div className="flex flex-wrap gap-2">
                {exampleQueries[activeTab].map((example, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80"
                    onClick={() => setQuery(example)}
                  >
                    {example}
                  </Badge>
                ))}
              </div>
            </div>

            {(response || isStreaming) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Respuesta:</label>
                  <div className="flex items-center gap-2">
                    {isStreaming && (
                      <Badge variant="outline" className="text-xs animate-pulse">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Generando...
                      </Badge>
                    )}
                    {!isStreaming && response && (
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        IA
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-4 prose prose-sm max-w-none dark:prose-invert min-h-[100px]">
                  <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {response || ""}
                    {isStreaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />}
                  </div>
                </div>
                {streamError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    ⚠️ {streamError}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
