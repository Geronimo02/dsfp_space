import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { 
  MessageCircle, 
  Phone, 
  Mail, 
  Plus, 
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Paperclip,
  Send,
  Settings,
  BookOpen,
  FileText
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { ArticleSuggestions } from "@/components/support/ArticleSuggestions";
import { SLAIndicator } from "@/components/support/SLAIndicator";
import { ResponseTemplatesManager } from "@/components/support/ResponseTemplatesManager";

export default function CustomerSupport() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    description: "",
    category: "other",
    priority: "medium",
    customer_id: ""
  });

  // Fetch tickets
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets", currentCompany?.id, searchQuery],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = (supabase as any)
        .from("customer_support_tickets")
        .select(`
          *,
          customers!customer_id(name, email, phone)
        `)
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`ticket_number.ilike.%${searchQuery}%,subject.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching tickets:", error);
        throw error;
      }
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch customers for dropdown
  const { data: customers } = useQuery({
    queryKey: ["customers-support", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, phone")
        .eq("company_id", currentCompany.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch messages for selected ticket
  const { data: messages } = useQuery({
    queryKey: ["support-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      const { data, error } = await (supabase as any)
        .from("customer_support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTicket?.id,
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data, error } = await (supabase as any)
        .from("customer_support_tickets")
        .insert([{
          ...ticketForm,
          company_id: currentCompany?.id,
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Ticket creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setIsNewTicketOpen(false);
      setTicketForm({
        subject: "",
        description: "",
        category: "other",
        priority: "medium",
        customer_id: ""
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear ticket");
    }
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error } = await (supabase as any)
        .from("customer_support_messages")
        .insert([{
          ticket_id: selectedTicket.id,
          sender_type: "agent",
          sender_id: user.id,
          message: newMessage,
        }]);

      if (error) throw error;

      // Update first_response_at if this is the first agent response
      if (!selectedTicket.first_response_at) {
        await (supabase as any)
          .from("customer_support_tickets")
          .update({ first_response_at: new Date().toISOString() })
          .eq("id", selectedTicket.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-messages"] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setNewMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar mensaje");
    }
  });

  // Update ticket status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string, status: string }) => {
      const updates: any = { status };
      
      if (status === "resolved") {
        updates.resolved_at = new Date().toISOString();
      } else if (status === "closed") {
        updates.closed_at = new Date().toISOString();
      }

      const { error } = await (supabase as any)
        .from("customer_support_tickets")
        .update(updates)
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: { variant: "default", label: "Abierto" },
      in_progress: { variant: "secondary", label: "En Progreso" },
      pending: { variant: "outline", label: "Pendiente" },
      resolved: { variant: "success", label: "Resuelto" },
      closed: { variant: "default", label: "Cerrado" }
    };
    return variants[status] || variants.open;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, any> = {
      low: { variant: "outline", label: "Baja", color: "text-gray-600" },
      medium: { variant: "secondary", label: "Media", color: "text-blue-600" },
      high: { variant: "default", label: "Alta", color: "text-orange-600" },
      urgent: { variant: "destructive", label: "Urgente", color: "text-red-600" }
    };
    return variants[priority] || variants.medium;
  };

  const stats = {
    open: tickets?.filter(t => t.status === "open").length || 0,
    inProgress: tickets?.filter(t => t.status === "in_progress").length || 0,
    resolved: tickets?.filter(t => t.status === "resolved").length || 0,
    total: tickets?.length || 0
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Atención al Cliente</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gestiona tickets de soporte. Las respuestas se envían automáticamente por email/SMS al cliente
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => navigate("/customer-support/knowledge-base")}>
              <BookOpen className="h-4 w-4 mr-2" />
              Base de Conocimiento
            </Button>
            <Button variant="outline" onClick={() => navigate("/customer-support/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
            <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Ticket de Soporte</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select 
                      value={ticketForm.customer_id} 
                      onValueChange={(val) => setTicketForm({...ticketForm, customer_id: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select 
                      value={ticketForm.category} 
                      onValueChange={(val) => setTicketForm({...ticketForm, category: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Técnico</SelectItem>
                        <SelectItem value="billing">Facturación</SelectItem>
                        <SelectItem value="sales">Ventas</SelectItem>
                        <SelectItem value="product">Producto</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select 
                    value={ticketForm.priority} 
                    onValueChange={(val) => setTicketForm({...ticketForm, priority: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input 
                    value={ticketForm.subject}
                    onChange={(e) => setTicketForm({...ticketForm, subject: e.target.value})}
                    placeholder="Descripción breve del problema..."
                  />
                  {ticketForm.subject.length >= 3 && (
                    <ArticleSuggestions 
                      searchText={ticketForm.subject}
                      onArticleSelect={(article) => {
                        toast.info(`Artículo sugerido: ${article.title}`);
                      }}
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea 
                    value={ticketForm.description}
                    onChange={(e) => setTicketForm({...ticketForm, description: e.target.value})}
                    placeholder="Detalles del problema..."
                    rows={5}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => createTicketMutation.mutate()}>
                    Crear Ticket
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Abiertos</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.open}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inProgress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resueltos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resolved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <MessageCircle className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Tickets List */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              {tickets?.map((ticket) => (
                <Card 
                  key={ticket.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedTicket?.id === ticket.id ? 'border-primary' : ''
                  }`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{ticket.ticket_number}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {ticket.subject}
                        </div>
                      </div>
                      <Badge {...getStatusBadge(ticket.status)} className="ml-2">
                        {getStatusBadge(ticket.status).label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ticket.customers?.name || 'Sin cliente'}
                      </span>
                      <Badge {...getPriorityBadge(ticket.priority)} className="text-xs">
                        {getPriorityBadge(ticket.priority).label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: es })}
                      </span>
                      <SLAIndicator ticket={ticket} />
                    </div>
                  </div>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* Ticket Detail / Chat */}
          <Card className="md:col-span-2">
            {selectedTicket ? (
              <>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedTicket.ticket_number}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedTicket.subject}
                      </p>
                    </div>
                    <Select 
                      value={selectedTicket.status}
                      onValueChange={(val) => updateStatusMutation.mutate({ 
                        ticketId: selectedTicket.id, 
                        status: val 
                      })}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Abierto</SelectItem>
                        <SelectItem value="in_progress">En Progreso</SelectItem>
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="resolved">Resuelto</SelectItem>
                        <SelectItem value="closed">Cerrado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-4 flex-wrap items-center">
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedTicket.customers?.name}
                    </div>
                    {selectedTicket.customers?.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {selectedTicket.customers.email}
                      </div>
                    )}
                    {selectedTicket.customers?.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {selectedTicket.customers.phone}
                      </div>
                    )}
                    <SLAIndicator ticket={selectedTicket} />
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="messages">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="messages">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Historial
                      </TabsTrigger>
                      <TabsTrigger value="calls">
                        <Phone className="h-4 w-4 mr-2" />
                        Llamadas
                      </TabsTrigger>
                      <TabsTrigger value="emails">
                        <Mail className="h-4 w-4 mr-2" />
                        Emails
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="messages" className="space-y-4">
                      {/* Messages */}
                      <div className="space-y-3 max-h-[400px] overflow-y-auto p-4 border rounded-lg">
                        {messages?.map((msg) => (
                          <div 
                            key={msg.id}
                            className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[70%] p-3 rounded-lg ${
                              msg.sender_type === 'agent' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-muted'
                            }`}>
                              <p className="text-sm">{msg.message}</p>
                              <p className="text-xs opacity-70 mt-1">
                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: es })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Send Message */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                          <Mail className="h-4 w-4" />
                          <span>Tu respuesta se enviará automáticamente por email al cliente: <strong>{selectedTicket.customers?.email}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm">
                                <FileText className="h-4 w-4 mr-2" />
                                Usar Plantilla
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80" align="start">
                              <ResponseTemplatesManager 
                                mode="select"
                                onSelectTemplate={(template) => {
                                  const customerName = selectedTicket?.customers?.name || 'Cliente';
                                  const content = template.content.replace('{nombre_cliente}', customerName);
                                  setNewMessage(prev => prev ? `${prev}\n\n${content}` : content);
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Textarea
                          placeholder="Escribe tu respuesta al cliente..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className="min-h-[80px]"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey && newMessage.trim()) {
                              sendMessageMutation.mutate();
                            }
                          }}
                        />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Presiona Ctrl+Enter para enviar</span>
                      <Button 
                        onClick={() => sendMessageMutation.mutate()}
                        disabled={!newMessage.trim()}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Enviar Email
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                    <TabsContent value="calls">
                      <div className="text-center text-muted-foreground py-8">
                        Historial de llamadas próximamente
                      </div>
                    </TabsContent>

                    <TabsContent value="emails">
                      <div className="text-center text-muted-foreground py-8">
                        Historial de emails próximamente
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-[600px]">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un ticket para ver los detalles</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}
