import { Layout } from "@/components/layout/Layout";
import { AIAssistant } from "@/components/AIAssistant";

const AIAssistantPage = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Asistente IA</h1>
          <p className="text-muted-foreground">
            Obtén insights y recomendaciones inteligentes sobre tu negocio
          </p>
        </div>

        <AIAssistant />
      </div>
    </Layout>
  );
};

export default AIAssistantPage;
