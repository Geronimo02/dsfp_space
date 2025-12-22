import { Layout } from "@/components/layout/Layout";
import { AIAssistant } from "@/components/AIAssistant";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, Clock } from "lucide-react";

const AIAssistantPage = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Asistente IA
              <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Beta
              </Badge>
            </h1>
            <p className="text-muted-foreground">
              Obtén insights y recomendaciones inteligentes sobre tu negocio
            </p>
          </div>
        </div>

        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-amber-600">Funcionalidad en Desarrollo</AlertTitle>
          <AlertDescription className="text-amber-600/80">
            El asistente IA está en fase beta. Próximamente: análisis predictivo de ventas, 
            recomendaciones de stock automáticas, detección de tendencias y generación de reportes avanzados.
          </AlertDescription>
        </Alert>

        <AIAssistant />
      </div>
    </Layout>
  );
};

export default AIAssistantPage;
