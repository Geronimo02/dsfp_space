import { useState } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useSSEStream } from "@/hooks/useSSEStream";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sparkles, Loader2, Send, StopCircle } from "lucide-react";
import { toast } from "sonner";

export const AIAssistantFloating = () => {
  const { currentCompany } = useCompany();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { text: response, isStreaming, error: streamError, startStream, stopStream } = useSSEStream({
    onComplete: (fullText) => {
      console.log("Streaming completado:", fullText.length, "caracteres");
    },
    onError: (error) => {
      toast.error(error || "Error al procesar tu consulta");
    },
  });

  const handleQuery = async (text?: string) => {
    const finalQuery = text || query;
    
    if (!finalQuery.trim()) {
      toast.error("Por favor ingresa una consulta");
      return;
    }

    if (isStreaming) {
      stopStream();
      return;
    }

    setQuery(finalQuery);

    // Auto-detectar el tipo de consulta
    const lq = finalQuery.toLowerCase();
    const type = lq.includes("empleado") || lq.includes("comision") || lq.includes("nómina") || lq.includes("rrhh") || lq.includes("horas trabajadas")
      ? "hr-analysis"
      : lq.includes("banco") || lq.includes("cheque") || lq.includes("tarjeta") || lq.includes("tesorería") || lq.includes("saldo")
      ? "treasury"
      : lq.includes("oportunidad") || lq.includes("pipeline") || lq.includes("crm") || lq.includes("lead")
      ? "crm-pipeline"
      : lq.includes("cuenta corriente") || lq.includes("vencido") || lq.includes("nota de crédito") || lq.includes("deudor") || lq.includes("cobro")
      ? "accounts-analysis"
      : lq.includes("compra") || lq.includes("orden de compra") || lq.includes("proveedor") || lq.includes("abastecimiento")
      ? "procurement"
      : lq.includes("ticket") || lq.includes("soporte") || lq.includes("sla") || lq.includes("reclamo")
      ? "support-analysis"
      : lq.includes("stock") || lq.includes("inventario") || lq.includes("reponer") || lq.includes("reposición")
      ? "stock-analysis"
      : lq.includes("predicción") || lq.includes("proyección") || lq.includes("tendencia")
      ? "sales-prediction"
      : lq.includes("cliente") || lq.includes("vip") || lq.includes("abandono")
      ? "customer-insights"
      : lq.includes("financ") || lq.includes("margen") || lq.includes("ganancia") || lq.includes("gasto")
      ? "financial-summary"
      : lq.includes("suger") || lq.includes("recomend")
      ? "suggestion"
      : lq.includes("por qué") || lq.includes("explica") || lq.includes("compar")
      ? "report"
      : "search";

    await startStream("ai-assistant-stream", {
      query: finalQuery,
      type,
      companyId: currentCompany?.id,
      context: type === "report" ? finalQuery : undefined,
    });
  };

  const exampleQueries = [
    "¿Cuáles son los productos más vendidos?",
    "Dame sugerencias para mejorar las ventas",
    "¿Qué productos necesito reponer?",
    "¿Cuánto pagué en comisiones este mes?",
    "¿Cuánto tengo en cuentas bancarias?",
    "Resumen financiero del mes",
    "¿Cuántas oportunidades abiertas tengo en el CRM?",
    "¿Tengo movimientos vencidos en cuenta corriente?",
    "¿Cuántos tickets de soporte están abiertos?",
    "¿Cuáles son mis órdenes de compra pendientes?",
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
                disabled={isStreaming}
                className="flex-1"
              />
              <Button onClick={() => handleQuery()} disabled={false} size="icon" variant={isStreaming ? "destructive" : "default"}>
                {isStreaming ? (
                  <StopCircle className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Ejemplos de consultas */}
          {!response && !isStreaming && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Prueba con alguna de estas:</p>
              <div className="grid gap-2">
                {exampleQueries.map((example, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    onClick={() => handleQuery(example)}
                    className="justify-start text-left h-auto py-3 px-4 whitespace-normal"
                    disabled={isStreaming}
                  >
                    <Sparkles className="h-4 w-4 mr-2 shrink-0" />
                    <span className="text-sm">{example}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Respuesta con streaming */}
          {(response || isStreaming) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {isStreaming ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generando respuesta...
                    </span>
                  ) : (
                    "Respuesta:"
                  )}
                </label>
                {!isStreaming && response && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                    }}
                  >
                    Nueva consulta
                  </Button>
                )}
              </div>
              <div className="bg-muted p-4 rounded-lg min-h-[200px] whitespace-pre-wrap text-sm relative">
                {response || ""}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                )}
              </div>
              {streamError && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  ⚠️ {streamError}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
