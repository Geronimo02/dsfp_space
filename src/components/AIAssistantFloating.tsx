import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Search, Lightbulb, BarChart, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const AIAssistantFloating = () => {
  const { currentCompany } = useCompany();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "suggestion" | "report">("search");
  const [open, setOpen] = useState(false);

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
      "Ventas del mes pasado de cemento",
      "Productos más vendidos",
      "Ventas de la última semana",
    ],
    suggestion: [
      "Mejora las ventas",
      "¿Qué productos comprar?",
      "Analiza mi stock",
    ],
    report: [
      "¿Por qué bajaron las ventas?",
      "Compara con el mes anterior",
      "Analiza tendencias",
    ],
  };

  return (
    <>
      {/* Botón flotante */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all z-50 p-0"
          >
            <Sparkles className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <SheetTitle>Asistente IA</SheetTitle>
            </div>
            <SheetDescription>
              Pregunta lo que necesites en lenguaje natural
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="search" className="gap-2">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Búsqueda</span>
                </TabsTrigger>
                <TabsTrigger value="suggestion" className="gap-2">
                  <Lightbulb className="h-4 w-4" />
                  <span className="hidden sm:inline">Sugerencias</span>
                </TabsTrigger>
                <TabsTrigger value="report" className="gap-2">
                  <BarChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Análisis</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tu consulta</label>
                  <div className="flex gap-2">
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={
                        activeTab === "search"
                          ? "Ej: Ventas del mes pasado..."
                          : activeTab === "suggestion"
                          ? "Ej: Dame sugerencias..."
                          : "Ej: Explica por qué..."
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                    />
                    <Button onClick={handleQuery} disabled={loading} size="icon">
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
                    <div className="bg-muted p-4 rounded-lg min-h-[200px] whitespace-pre-wrap">
                      {response}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
