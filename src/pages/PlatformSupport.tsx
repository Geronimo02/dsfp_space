import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { LifeBuoy, Plus, MessageSquare, BarChart3, Crown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { TicketStatusBadge, getPriorityBadge } from "@/components/platformSupport/TicketStatusBadge";
import { TicketAttachments } from "@/components/platformSupport/TicketAttachments";
import { PlatformSupportMetrics } from "@/components/platformSupport/PlatformSupportMetrics";
import { usePlatformSupportRealtime } from "@/hooks/usePlatformSupportRealtime";

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export default function PlatformSupport() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messageAttachments, setMessageAttachments] = useState<Attachment[]>([]);
  const [activeTab, setActiveTab] = useState("tickets");

  const [ticketForm, setTicketForm] = useState({
    subject: "",
    description: "",
    category: "technical",
    priority: "medium",
  });

  // Realtime notifications
  usePlatformSupportRealtime({
    companyId: currentCompany?.id,
    ticketId: selectedTicket?.id,
    onTicketUpdate: (updatedTicket: any) => {
      // Update the selected ticket if it's the one being viewed
      if (updatedTicket.id === selectedTicket?.id) {
        setSelectedTicket(updatedTicket);
      }
    },
  });

  // Fetch tickets
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["platform-support-tickets", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await (supabase as any)
        .from("platform_support_tickets")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch messages for selected ticket
  const { data: messages } = useQuery({
    queryKey: ["platform-support-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      const { data, error } = await (supabase as any)
        .from("platform_support_messages")
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
      if (!currentCompany?.id) throw new Error("No hay empresa seleccionada");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
      const ticketNumber = `TKT-${dateStr}-${randomStr}`;

      const { data: createdTickets, error: ticketError } = await supabase
        .from("platform_support_tickets" as any)
        .insert([{
          ...ticketForm,
          ticket_number: ticketNumber,
          company_id: currentCompany.id,
          created_by: user.id,
        }])
        .select("id, ticket_number") as unknown as { data: any[]; error: any };

      if (ticketError) throw ticketError;

      const createdTicket = createdTickets?.[0];

      if (createdTicket) {
        try {
          const [adminNotification, companyNotification] = await Promise.all([
            supabase.functions.invoke("notify-admins-platform-ticket", {
              body: {
                ticketId: createdTicket.id,
                ticketNumber,
                companyId: currentCompany.id,
                companyName: currentCompany.name,
                subject: ticketForm.subject,
                description: ticketForm.description,
                priority: ticketForm.priority,
                category: ticketForm.category,
              },
            }),
            supabase.functions.invoke("notify-platform-support-ticket", {
              body: {
                ticket_id: createdTicket.id,
                type: "ticket_created",
                send_email: true,
                send_whatsapp: true,
              },
            }),
          ]);

          if (adminNotification.error) {
            console.error("Error notificando a admins:", adminNotification.error);
          }
          if (companyNotification.error) {
            console.error("Error notificando a la empresa:", companyNotification.error);
          }
        } catch (notificationError) {
          console.error("Error llamando a edge functions de notificación:", notificationError);
        }
      }
    },
    onSuccess: () => {
      toast.success("Ticket creado. Los administradores lo revisarán pronto.");
      queryClient.invalidateQueries({ queryKey: ["platform-support-tickets"] });
      setIsNewTicketOpen(false);
      setTicketForm({
        subject: "",
        description: "",
        category: "technical",
        priority: "medium",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear ticket");
    },
  });

  // Update ticket status mutation
  const updateTicketStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!selectedTicket?.id) throw new Error("No hay ticket seleccionado");

      const { data, error } = await (supabase as any)
        .from("platform_support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id)
        .select("*")
        .single();

      if (error) throw error;
      if (!data) throw new Error("No se pudo actualizar el ticket");
      return data;
    },
    onSuccess: (updatedTicket) => {
      // Update the selected ticket with fresh data from DB
      setSelectedTicket(updatedTicket);
      // Invalidate and refetch the tickets list
      queryClient.invalidateQueries({ 
        queryKey: ["platform-support-tickets", currentCompany?.id],
        refetchType: 'all'
      });
      toast.success("Estado actualizado correctamente");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar estado");
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket?.id || !newMessage.trim()) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error } = await (supabase as any)
        .from("platform_support_messages")
        .insert([{
          ticket_id: selectedTicket.id,
          sender_type: "company",
          sender_id: user.id,
          message: newMessage,
          attachments: messageAttachments.length > 0 ? messageAttachments : null,
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-support-messages"] });
      setNewMessage("");
      setMessageAttachments([]);
      toast.success("Mensaje enviado");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar mensaje");
    },
  });

  const stats = {
    open: tickets?.filter((t: any) => t.status === "open").length || 0,
    inProgress: tickets?.filter((t: any) => t.status === "in_progress").length || 0,
    waitingInfo: tickets?.filter((t: any) => t.waiting_for_customer).length || 0,
    resolved: tickets?.filter((t: any) => t.status === "resolved").length || 0,
    total: tickets?.length || 0,
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <LifeBuoy className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
              Soporte de Plataforma
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              ¿Tienes problemas o necesitas ayuda? Crea un ticket y te ayudaremos
            </p>
          </div>
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="w-full sm:w-auto shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                Reportar Problema
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crear Ticket de Soporte</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Asunto</Label>
                  <Input
                    placeholder="Describe brevemente el problema"
                    value={ticketForm.subject}
                    onChange={(e) =>
                      setTicketForm({ ...ticketForm, subject: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descripción Detallada</Label>
                  <Textarea
                    placeholder="Explica el problema con el mayor detalle posible"
                    value={ticketForm.description}
                    onChange={(e) =>
                      setTicketForm({ ...ticketForm, description: e.target.value })
                    }
                    className="min-h-[120px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select
                      value={ticketForm.category}
                      onValueChange={(val) =>
                        setTicketForm({ ...ticketForm, category: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">🔧 Problema Técnico</SelectItem>
                        <SelectItem value="billing">💰 Facturación</SelectItem>
                        <SelectItem value="feature_request">✨ Solicitar Función</SelectItem>
                        <SelectItem value="bug">🐛 Reportar Bug</SelectItem>
                        <SelectItem value="account">👤 Problema de Cuenta</SelectItem>
                        <SelectItem value="other">📋 Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Prioridad</Label>
                    <Select
                      value={ticketForm.priority}
                      onValueChange={(val) =>
                        setTicketForm({ ...ticketForm, priority: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">🟢 Baja</SelectItem>
                        <SelectItem value="medium">🟡 Media</SelectItem>
                        <SelectItem value="high">🟠 Alta</SelectItem>
                        <SelectItem value="urgent">🔴 Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  La prioridad se ajusta automáticamente según tu plan de suscripción
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => createTicketMutation.mutate()}
                    disabled={!ticketForm.subject || !ticketForm.description}
                  >
                    Crear Ticket
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tickets" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Mis Tickets
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Métricas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="mt-6">
            <PlatformSupportMetrics />
          </TabsContent>

          <TabsContent value="tickets" className="mt-6">
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-5 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Abiertos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.open}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    En Progreso
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Esperando Info
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stats.waitingInfo}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Resueltos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>
            </div>

            {/* Tickets List & Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* List */}
              <Card>
                <CardHeader>
                  <CardTitle>Mis Tickets</CardTitle>
                  <CardDescription>Problemas reportados a soporte</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {tickets && tickets.length > 0 ? (
                      tickets.map((ticket: any) => (
                        <div
                          key={ticket.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                            selectedTicket?.id === ticket.id ? "bg-muted border-primary" : ""
                          }`}
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-medium">
                                {ticket.ticket_number}
                              </span>
                              <TicketStatusBadge 
                                status={ticket.status}
                                waitingForCustomer={ticket.waiting_for_customer}
                                escalated={!!ticket.escalated_at}
                              />
                              {getPriorityBadge(ticket.priority, ticket.auto_priority_reason)}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(ticket.created_at), {
                                addSuffix: true,
                                locale: es,
                              })}
                            </span>
                          </div>
                          <h4 className="font-medium mb-1">{ticket.subject}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {ticket.description}
                          </p>
                          {ticket.auto_priority_reason && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Crown className="h-3 w-3 text-yellow-500" />
                              {ticket.auto_priority_reason}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <LifeBuoy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No hay tickets creados</p>
                        <p className="text-sm">Crea uno si necesitas ayuda</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Detail */}
              <Card>
                {selectedTicket ? (
                  <>
                    <CardHeader>
                      <div>
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <CardTitle className="text-lg">{selectedTicket.ticket_number}</CardTitle>
                          <div className="flex items-center gap-2">
                            <TicketStatusBadge 
                              status={selectedTicket.status}
                              waitingForCustomer={selectedTicket.waiting_for_customer}
                              escalated={!!selectedTicket.escalated_at}
                            />
                            {getPriorityBadge(selectedTicket.priority, selectedTicket.auto_priority_reason)}
                          </div>
                        </div>
                        <CardDescription>{selectedTicket.subject}</CardDescription>
                        <div className="flex items-center gap-2 mt-3">
                          <Label className="text-xs">Estado:</Label>
                          <Select
                            value={selectedTicket.status}
                            onValueChange={(newStatus) => updateTicketStatusMutation.mutate(newStatus)}
                            disabled={updateTicketStatusMutation.isPending}
                          >
                            <SelectTrigger className="w-auto h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Abierto</SelectItem>
                              <SelectItem value="in_progress">En Progreso</SelectItem>
                              <SelectItem value="resolved">Resuelto</SelectItem>
                              <SelectItem value="closed">Cerrado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedTicket.sla_response_hours && (
                          <div className="text-xs text-muted-foreground mt-2">
                            SLA: Respuesta en {selectedTicket.sla_response_hours}h | Resolución en {selectedTicket.sla_resolution_hours}h
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm">{selectedTicket.description}</p>
                      </div>

                      {/* Messages */}
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {messages?.map((msg: any) => (
                          <div
                            key={msg.id}
                            className={`flex ${
                              msg.sender_type === "company" ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[80%] p-3 rounded-lg ${
                                msg.sender_type === "company"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <p className="text-sm">{msg.message}</p>
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-white/20">
                                  <TicketAttachments
                                    ticketId={selectedTicket.id}
                                    attachments={msg.attachments}
                                    readOnly
                                  />
                                </div>
                              )}
                              <p className="text-xs opacity-70 mt-1">
                                {formatDistanceToNow(new Date(msg.created_at), {
                                  addSuffix: true,
                                  locale: es,
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Send Message */}
                      {selectedTicket.status !== "closed" && (
                        <div className="space-y-3">
                          <TicketAttachments
                            ticketId={selectedTicket.id}
                            attachments={[]}
                            onAttachmentsChange={setMessageAttachments}
                          />
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Escribe un mensaje..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              className="min-h-[60px]"
                            />
                            <Button
                              onClick={() => sendMessageMutation.mutate()}
                              disabled={!newMessage.trim()}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="flex items-center justify-center h-[600px]">
                    <div className="text-center text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Selecciona un ticket para ver los detalles</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
