import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
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
  Target
} from "lucide-react";
import { toast } from "sonner";

type AnalysisType = "search" | "suggestion" | "report" | "stock-analysis" | "sales-prediction" | "customer-insights" | "financial-summary";

export const AIAssistant = () => {
  const { currentCompany } = useCompany();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisType>("search");

  const handleQuery = async (customQuery?: string, customType?: AnalysisType) => {
    const finalQuery = customQuery || query;
    const finalType = customType || activeTab;
    
    if (!finalQuery.trim()) {
      toast.error("Por favor ingresa una consulta");
      return;
    }

    setLoading(true);
    setResponse("");

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          query: finalQuery,
          type: finalType,
          companyId: currentCompany?.id,
          context: finalType === "report" ? finalQuery : undefined,
        },
      });

      if (error) throw error;

      setResponse(data.response);
    } catch (error) {
      console.error("Error al consultar IA:", error);
      toast.error("Error al procesar tu consulta");
    } finally {
      setLoading(false);
    }
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
  };

  const tabConfig = [
    { value: "search", icon: Search, label: "Búsqueda" },
    { value: "suggestion", icon: Lightbulb, label: "Sugerencias" },
    { value: "report", icon: BarChart, label: "Análisis" },
    { value: "stock-analysis", icon: Package, label: "Stock" },
    { value: "sales-prediction", icon: TrendingUp, label: "Predicción" },
    { value: "customer-insights", icon: Users, label: "Clientes" },
    { value: "financial-summary", icon: DollarSign, label: "Finanzas" },
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
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
                disabled={loading}
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
          <TabsList className="grid w-full grid-cols-7">
            {tabConfig.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1 text-xs px-2">
                <tab.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{tab.label}</span>
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
                <Button onClick={() => handleQuery()} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
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

            {response && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Respuesta:</label>
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    IA
                  </Badge>
                </div>
                <div className="bg-muted rounded-lg p-4 prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {response}
                  </pre>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
