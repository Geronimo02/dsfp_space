import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Search, Lightbulb, BarChart, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const AIAssistant = () => {
  const { currentCompany } = useCompany();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "suggestion" | "report">("search");

  const handleQuery = async () => {
    if (!query.trim()) {
      toast.error("Por favor ingresa una consulta");
      return;
    }

    setLoading(true);
    setResponse("");

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          query,
          type: activeTab,
          companyId: currentCompany?.id,
          context: activeTab === "report" ? query : undefined,
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

  const exampleQueries = {
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
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Asistente IA</CardTitle>
        </div>
        <CardDescription>
          Pregunta lo que necesites en lenguaje natural
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              Búsqueda
            </TabsTrigger>
            <TabsTrigger value="suggestion" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Sugerencias
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-2">
              <BarChart className="h-4 w-4" />
              Análisis
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tu consulta</label>
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    activeTab === "search"
                      ? "Ej: Mostrame las ventas del mes pasado..."
                      : activeTab === "suggestion"
                      ? "Ej: Dame sugerencias para mejorar..."
                      : "Ej: Explica por qué bajaron las ventas..."
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                />
                <Button onClick={handleQuery} disabled={loading}>
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
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(example)}
                    className="text-xs"
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>

            {response && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Respuesta:</label>
                <Textarea
                  value={response}
                  readOnly
                  className="min-h-[200px] bg-muted"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
