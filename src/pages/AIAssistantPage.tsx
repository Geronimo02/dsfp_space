import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { 
  Sparkles, Send, Package, TrendingUp, Users, DollarSign,
  MessageSquare, Lightbulb, BarChart3, Loader2, Bot, User,
  RefreshCw, History, Trash2, ExternalLink, Briefcase, Landmark,
  ChevronRight, Plus, Target, CreditCard, ShoppingCart, Headphones
} from "lucide-react";
import { useSSEStream } from "@/hooks/useSSEStream";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: ParsedAction[];
}

interface ParsedAction {
  action: string;
  path?: string;
  label?: string;
}

interface Conversation {
  id: string;
  title: string;
  analysis_type: string;
  created_at: string;
  updated_at: string;
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
  {
    id: "hr-analysis",
    title: "Análisis de RRHH",
    description: "Dotación, comisiones, horas y costo laboral",
    icon: <Briefcase className="h-5 w-5" />,
    type: "hr-analysis",
    query: "Analiza mi equipo de trabajo. ¿Cuántos empleados tengo? ¿Cómo están las comisiones y horas trabajadas?"
  },
  {
    id: "treasury",
    title: "Tesorería",
    description: "Saldos bancarios, cheques y tarjetas pendientes",
    icon: <Landmark className="h-5 w-5" />,
    type: "treasury",
    query: "Dame un resumen de tesorería. ¿Cuánto tengo en bancos? ¿Cheques y tarjetas pendientes?"
  },
  {
    id: "crm-pipeline",
    title: "CRM / Pipeline",
    description: "Oportunidades abiertas, valor ponderado y conversión",
    icon: <Target className="h-5 w-5" />,
    type: "crm-pipeline",
    query: "Analiza mi pipeline comercial. ¿Cuántas oportunidades abiertas tengo? ¿Cuál es el valor ponderado? ¿Tasa de conversión?"
  },
  {
    id: "accounts-analysis",
    title: "Cuenta Corriente",
    description: "Cobros, vencimientos, notas de crédito y deudores",
    icon: <CreditCard className="h-5 w-5" />,
    type: "accounts-analysis",
    query: "Analiza mi cuenta corriente. ¿Cuántos movimientos vencidos tengo? ¿Notas de crédito pendientes? ¿Deudores principales?"
  },
  {
    id: "procurement",
    title: "Compras Detalle",
    description: "Órdenes de compra, costos y productos más comprados",
    icon: <ShoppingCart className="h-5 w-5" />,
    type: "procurement",
    query: "Analiza mis compras. ¿Cuántas órdenes abiertas tengo? ¿Cuáles son los productos más comprados y sus costos?"
  },
  {
    id: "support-analysis",
    title: "Soporte al Cliente",
    description: "Tickets abiertos, SLA y prioridades",
    icon: <Headphones className="h-5 w-5" />,
    type: "support-analysis",
    query: "Analiza mis tickets de soporte. ¿Cuántos están abiertos? ¿Se cumplen los SLA? ¿Cuáles son las categorías más frecuentes?"
  },
];

// Route labels for navigation actions
const routeLabels: Record<string, string> = {
  '/inventory-alerts': 'Alertas de Inventario',
  '/reports': 'Reportes',
  '/accounts-receivable': 'Cuentas por Cobrar',
  '/quotations': 'Cotizaciones',
  '/technical-services': 'Servicios Técnicos',
  '/cash-register': 'Caja',
  '/employees': 'Empleados',
  '/commissions': 'Comisiones',
  '/payroll': 'Nómina',
  '/expenses': 'Gastos',
  '/promotions': 'Promociones',
  '/returns': 'Devoluciones',
  '/warehouses': 'Depósitos',
  '/bank-accounts': 'Cuentas Bancarias',
  '/suppliers': 'Proveedores',
  '/customers': 'Clientes',
  '/products': 'Productos',
  '/sales': 'Ventas',
  '/purchase-orders': 'Órdenes de Compra',
  '/crm': 'CRM Pipeline',
  '/customer-support': 'Soporte al Cliente',
};

function parseActions(content: string): { cleanContent: string; actions: ParsedAction[] } {
  const actions: ParsedAction[] = [];
  const cleanContent = content.replace(/\[ACTION:(.*?)\]/g, (_, json) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.path) {
        parsed.label = routeLabels[parsed.path] || parsed.path;
      }
      actions.push(parsed);
    } catch { /* ignore bad json */ }
    return '';
  }).trim();
  return { cleanContent, actions };
}

const AIAssistantPage = () => {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState("chat");
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamCompleteRef = useRef<((fullText: string) => void) | null>(null);
  const streamErrorRef = useRef<((error: string) => void) | null>(null);

  const { text: streamedContent, isStreaming, startStream, stopStream } = useSSEStream({
    onComplete: (fullText) => { if (streamCompleteRef.current) streamCompleteRef.current(fullText); },
    onError: (error) => { if (streamErrorRef.current) streamErrorRef.current(error); },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, streamedContent]);

  // ─── Conversation list ──────────────────────────────
  const { data: conversations = [] } = useQuery({
    queryKey: ['ai-conversations', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, title, analysis_type, created_at, updated_at')
        .eq('company_id', currentCompany.id)
        .order('updated_at', { ascending: false })
        .limit(30);
      return (data || []) as Conversation[];
    },
    enabled: !!currentCompany?.id,
  });

  // ─── Load conversation messages ─────────────────────
  const loadConversation = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('ai_conversation_messages')
      .select('role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      const loaded: Message[] = data
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => {
          const { cleanContent, actions } = parseActions(m.content);
          return {
            role: m.role as 'user' | 'assistant',
            content: cleanContent,
            timestamp: new Date(m.created_at),
            actions: actions.length > 0 ? actions : undefined,
          };
        });
      setMessages(loaded);
      setCurrentConversationId(convId);
      setShowHistory(false);
      setActiveTab("chat");
    }
  }, []);

  // ─── Create conversation ────────────────────────────
  const createConversation = async (title: string, type: string): Promise<string> => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId || !currentCompany?.id) throw new Error('No user/company');

    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ company_id: currentCompany.id, user_id: userId, title, analysis_type: type })
      .select('id')
      .single();

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    return data.id;
  };

  // ─── Save message ──────────────────────────────────
  const saveMessage = async (conversationId: string, role: string, content: string) => {
    await supabase.from('ai_conversation_messages').insert({
      conversation_id: conversationId,
      role,
      content,
    });
    // Update conversation timestamp
    await supabase.from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  };

  // ─── Delete conversation ───────────────────────────
  const deleteConversation = useMutation({
    mutationFn: async (convId: string) => {
      await supabase.from('ai_conversation_messages').delete().eq('conversation_id', convId);
      await supabase.from('ai_conversations').delete().eq('id', convId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      if (currentConversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    },
  });

  // ─── Send message with SSE streaming ───────────────
  const handleSendMessage = useCallback(async (query: string, type: string) => {
    if (isStreaming) return;

    const userMessage: Message = { role: "user", content: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);

    // Ensure conversation exists
    let convId = currentConversationId;
    if (!convId) {
      try {
        const title = query.length > 60 ? query.slice(0, 57) + '...' : query;
        convId = await createConversation(title, type);
        setCurrentConversationId(convId);
      } catch (e) {
        console.error('Failed to create conversation:', e);
      }
    }

    // Save user message
    if (convId) {
      await saveMessage(convId, 'user', query);
    }

    // Build conversation history for context
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      // Use a promise to wait for streaming completion
      const fullResponse = await new Promise<string>((resolve, reject) => {
        streamCompleteRef.current = resolve;
        streamErrorRef.current = (err) => reject(new Error(err));

        startStream('ai-assistant-stream', {
          query, type, companyId: currentCompany?.id, conversationHistory: history,
        });
      });

      const { cleanContent, actions } = parseActions(fullResponse);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date(),
        actions: actions.length > 0 ? actions : undefined,
      }]);

      // Save assistant response
      if (convId) {
        await saveMessage(convId, 'assistant', fullResponse);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error.message || 'Error desconocido'}. Por favor intenta de nuevo.`,
        timestamp: new Date(),
      }]);
    }
  }, [currentConversationId, messages, isStreaming, currentCompany?.id, startStream]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    const query = input;
    setInput("");
    handleSendMessage(query, currentType);
  };

  const handleQuickAction = (action: QuickAction) => {
    setCurrentType(action.type);
    setActiveTab("chat");
    handleSendMessage(action.query, action.type);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const newChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setCurrentType("chat");
  };

  return (
    <Layout>
      <div className="w-full p-6 max-w-none min-h-screen">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
              Asistente IA
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Análisis inteligente y recomendaciones para tu negocio
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setShowHistory(!showHistory)} className="flex-1 sm:flex-none">
              <History className="h-4 w-4 mr-2" />
              Historial
            </Button>
            <Button variant="outline" onClick={newChat} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              Nueva
            </Button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Conversation history sidebar */}
          {showHistory && (
            <Card className="w-80 shrink-0 hidden md:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Conversaciones</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[560px]">
                  {conversations.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">Sin conversaciones previas</p>
                  ) : (
                    <div className="space-y-1 p-2">
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted group ${
                            conv.id === currentConversationId ? 'bg-muted' : ''
                          }`}
                          onClick={() => loadConversation(conv.id)}
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{conv.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(conv.updated_at).toLocaleDateString('es-AR')}
                            </p>
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); deleteConversation.mutate(conv.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Main content */}
          <div className="flex-1 min-w-0">
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
                      Pregunta sobre ventas, inventario, clientes, RRHH, tesorería o cualquier aspecto de tu negocio
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col p-0">
                    <ScrollArea className="flex-1 p-4">
                      {messages.length === 0 && !isStreaming ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                          <Bot className="h-16 w-16 text-muted-foreground/50 mb-4" />
                          <h3 className="text-lg font-semibold mb-2">¡Hola! Soy tu asistente de negocio</h3>
                          <p className="text-muted-foreground max-w-md">
                            Puedo ayudarte a analizar ventas, inventario, clientes, finanzas, RRHH, tesorería y mucho más.
                          </p>
                          <div className="mt-6 flex flex-wrap gap-2 justify-center">
                            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => setInput("¿Cuáles fueron mis ventas de hoy?")}>
                              ¿Ventas de hoy?
                            </Badge>
                            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => setInput("¿Qué productos necesito reponer?")}>
                              Stock bajo
                            </Badge>
                            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => setInput("¿Cómo están mis cuentas bancarias?")}>
                              Tesorería
                            </Badge>
                            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80" onClick={() => setInput("¿Cuánto pagué en comisiones?")}>
                              Comisiones
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages.map((message, index) => (
                            <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                              {message.role === "assistant" && (
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Bot className="h-4 w-4 text-primary" />
                                </div>
                              )}
                              <div className={`max-w-[80%] rounded-lg p-4 ${
                                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                              }`}>
                                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                                {/* Action buttons */}
                                {message.actions && message.actions.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {message.actions.map((act, i) => (
                                      act.action === 'navigate' && act.path ? (
                                        <Button
                                          key={i} variant="outline" size="sm"
                                          className="text-xs h-7"
                                          onClick={() => navigate(act.path!)}
                                        >
                                          <ExternalLink className="h-3 w-3 mr-1" />
                                          {act.label || act.path}
                                        </Button>
                                      ) : null
                                    ))}
                                  </div>
                                )}
                                <div className={`text-xs mt-2 ${
                                  message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}>
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
                          {isStreaming && streamedContent && (
                            <div className="flex gap-3 justify-start">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Bot className="h-4 w-4 text-primary" />
                              </div>
                              <div className="max-w-[80%] bg-muted rounded-lg p-4">
                                <div className="whitespace-pre-wrap text-sm">{streamedContent}</div>
                                <div className="flex items-center gap-1 mt-2">
                                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Escribiendo...</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isStreaming && !streamedContent && (
                            <div className="flex gap-3 justify-start">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Bot className="h-4 w-4 text-primary" />
                              </div>
                              <div className="bg-muted rounded-lg p-4">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="text-sm">Analizando datos del negocio...</span>
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
                          onKeyDown={handleKeyPress}
                          disabled={isStreaming}
                          className="flex-1"
                        />
                        <Button onClick={handleSend} disabled={!input.trim() || isStreaming}>
                          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quickActions.map((action) => (
                    <Card
                      key={action.id}
                      className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md"
                      onClick={() => handleQuickAction(action)}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">{action.icon}</div>
                          <div>
                            <CardTitle className="text-lg">{action.title}</CardTitle>
                            <CardDescription>{action.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground italic">"{action.query}"</p>
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
                    <CardDescription>Haz preguntas específicas sobre tu negocio</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: "Producto estrella", q: "¿Cuál es mi producto más vendido?" },
                        { label: "Mejor día", q: "¿Qué día de la semana vendo más?" },
                        { label: "Flujo de caja", q: "¿Cuánto debería tener en caja?" },
                        { label: "Empleados", q: "¿Cómo está el rendimiento de mis empleados?" },
                        { label: "Cheques", q: "¿Qué cheques tengo pendientes?" },
                        { label: "Cotizaciones", q: "¿Cuántas cotizaciones abiertas tengo?" },
                        { label: "Devoluciones", q: "¿Cuántas devoluciones tuve este mes?" },
                        { label: "Promociones", q: "¿Qué promociones me recomiendas?" },
                      ].map((item) => (
                        <Badge
                          key={item.label}
                          variant="outline"
                          className="justify-center py-2 cursor-pointer hover:bg-background"
                          onClick={() => { setInput(item.q); setActiveTab("chat"); }}
                        >
                          {item.label}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AIAssistantPage;
