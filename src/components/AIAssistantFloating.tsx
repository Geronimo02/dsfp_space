import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export const AIAssistantFloating = () => {
  const { currentCompany } = useCompany();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleQuery = async (text?: string) => {
    const finalQuery = text || query;
    
    if (!finalQuery.trim()) {
      toast.error("Por favor ingresa una consulta");
      return;
    }

    setLoading(true);
    setResponse("");
    setQuery(finalQuery);

    try {
      // Auto-detectar el tipo de consulta
      const type = finalQuery.toLowerCase().includes("suger") || finalQuery.toLowerCase().includes("recomend") 
        ? "suggestion"
        : finalQuery.toLowerCase().includes("por qué") || finalQuery.toLowerCase().includes("explica") || finalQuery.toLowerCase().includes("compar")
        ? "report"
        : "search";

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          query: finalQuery,
          type,
          companyId: currentCompany?.id,
          context: type === "report" ? finalQuery : undefined,
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

  const exampleQueries = [
    "Mostrame las ventas del mes pasado de cemento",
    "¿Cuáles son los productos más vendidos?",
    "Dame sugerencias para mejorar las ventas",
    "¿Qué productos debería comprar más?",
    "Explica por qué bajaron las ventas este mes",
    "Compara las ventas con el mes anterior",
  ];

  return (
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
            Pregunta lo que necesites sobre tu negocio
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Input principal */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribe tu consulta aquí..."
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
                disabled={loading}
                className="flex-1"
              />
              <Button onClick={() => handleQuery()} disabled={loading} size="icon">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Ejemplos de consultas */}
          {!response && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Prueba con alguna de estas:</p>
              <div className="grid gap-2">
                {exampleQueries.map((example, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    onClick={() => handleQuery(example)}
                    className="justify-start text-left h-auto py-3 px-4 whitespace-normal"
                    disabled={loading}
                  >
                    <Sparkles className="h-4 w-4 mr-2 shrink-0" />
                    <span className="text-sm">{example}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Respuesta */}
          {response && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Respuesta:</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResponse("");
                    setQuery("");
                  }}
                >
                  Nueva consulta
                </Button>
              </div>
              <div className="bg-muted p-4 rounded-lg min-h-[200px] whitespace-pre-wrap text-sm">
                {response}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
