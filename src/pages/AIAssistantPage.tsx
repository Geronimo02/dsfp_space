import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sparkles, 
  Send, 
  Package, 
  TrendingUp, 
  Users, 
  DollarSign,
  MessageSquare,
  Lightbulb,
  BarChart3,
  Loader2,
  Bot,
  User,
  RefreshCw
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  type: string;
  query: string;
}

const quickActions: QuickAction[] = [
  {
    id: "stock-analysis",
    title: "Análisis de Stock",
    description: "Productos con bajo stock y recomendaciones de reposición",
    icon: <Package className="h-5 w-5" />,
    type: "stock-analysis",
    query: "Analiza mi inventario actual. ¿Qué productos necesitan reposición urgente? ¿Cuáles tienen rotación lenta?"
  },
  {
    id: "sales-prediction",
    title: "Predicción de Ventas",
    description: "Proyecciones y tendencias basadas en datos históricos",
    icon: <TrendingUp className="h-5 w-5" />,
    type: "sales-prediction",
    query: "Analiza mis tendencias de ventas. ¿Cómo proyectas las ventas para la próxima semana? ¿Qué días son más fuertes?"
  },
  {
    id: "customer-insights",
    title: "Insights de Clientes",
    description: "Análisis de comportamiento y segmentación",
    icon: <Users className="h-5 w-5" />,
    type: "customer-insights",
    query: "Dame un análisis de mis clientes. ¿Quiénes son los más valiosos? ¿Hay clientes en riesgo de abandono?"
  },
  {
    id: "financial-summary",
    title: "Resumen Financiero",
    description: "Estado de ingresos, gastos y cuentas por cobrar",
    icon: <DollarSign className="h-5 w-5" />,
    type: "financial-summary",
    query: "Dame un resumen financiero del último mes. ¿Cómo está mi margen? ¿Cuánto tengo pendiente de cobrar?"
  },
];

const AIAssistantPage = () => {
  const { currentCompany } = useCompany();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async ({ query, type }: { query: string; type: string }) => {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          query,
          type,
          companyId: currentCompany?.id,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.response;
    },
    onSuccess: (response) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response,
          timestamp: new Date(),
        },
      ]);
    },
    onError: (error: any) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message}. Por favor intenta de nuevo.`,
          timestamp: new Date(),
        },
      ]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate({ query: input, type: "chat" });
    setInput("");
  };

  const handleQuickAction = (action: QuickAction) => {
    const userMessage: Message = {
      role: "user",
      content: action.query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    chatMutation.mutate({ query: action.query, type: action.type });
    setActiveTab("chat");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <Layout>
      <div className="w-full p-6 max-w-none min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Asistente IA
            </h1>
            <p className="text-muted-foreground">
              Análisis inteligente y recomendaciones para tu negocio
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" onClick={clearChat}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Nueva conversación
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Acciones Rápidas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Conversación con IA
                </CardTitle>
                <CardDescription>
                  Pregunta sobre ventas, inventario, clientes o cualquier aspecto de tu negocio
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-semibold mb-2">¡Hola! Soy tu asistente de negocio</h3>
                      <p className="text-muted-foreground max-w-md">
                        Puedo ayudarte a analizar tus ventas, gestionar inventario, 
                        entender el comportamiento de tus clientes y mucho más.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => setInput("¿Cuáles fueron mis ventas de hoy?")}>
                          ¿Ventas de hoy?
                        </Badge>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => setInput("¿Qué productos necesito reponer?")}>
                          Stock bajo
                        </Badge>
                        <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => setInput("¿Quiénes son mis mejores clientes?")}>
                          Mejores clientes
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex gap-3 ${
                            message.role === "user" ? "justify-end" : "justify-start"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg p-4 ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm">
                              {message.content}
                            </div>
                            <div
                              className={`text-xs mt-2 ${
                                message.role === "user"
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                          {message.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ))}
                      {chatMutation.isPending && (
                        <div className="flex gap-3 justify-start">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                          <div className="bg-muted rounded-lg p-4">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm">Analizando datos...</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Escribe tu pregunta aquí..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={chatMutation.isPending}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || chatMutation.isPending}
                    >
                      {chatMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <Card
                  key={action.id}
                  className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
                  onClick={() => handleQuickAction(action)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {action.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{action.title}</CardTitle>
                        <CardDescription>{action.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground italic">
                      "{action.query}"
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Análisis Personalizado
                </CardTitle>
                <CardDescription>
                  Haz preguntas específicas sobre tu negocio en el chat
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Badge variant="outline" className="justify-center py-2 cursor-pointer hover:bg-background" onClick={() => { setInput("¿Cuál es mi producto más vendido?"); setActiveTab("chat"); }}>
                    Producto estrella
                  </Badge>
                  <Badge variant="outline" className="justify-center py-2 cursor-pointer hover:bg-background" onClick={() => { setInput("¿Qué día de la semana vendo más?"); setActiveTab("chat"); }}>
                    Mejor día
                  </Badge>
                  <Badge variant="outline" className="justify-center py-2 cursor-pointer hover:bg-background" onClick={() => { setInput("¿Cuánto debería tener en caja?"); setActiveTab("chat"); }}>
                    Flujo de caja
                  </Badge>
                  <Badge variant="outline" className="justify-center py-2 cursor-pointer hover:bg-background" onClick={() => { setInput("¿Qué promociones me recomiendas?"); setActiveTab("chat"); }}>
                    Promociones
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default AIAssistantPage;
