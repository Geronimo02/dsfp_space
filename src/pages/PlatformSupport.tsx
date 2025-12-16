import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { LifeBuoy, Plus, AlertCircle, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function PlatformSupport() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");

  const [ticketForm, setTicketForm] = useState({
    subject: "",
    description: "",
    category: "technical",
    priority: "medium",
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

      // Generar ticket_number único: TKT-YYYYMMDD-XXX (máx 20 caracteres)
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
      const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
      const ticketNumber = `TKT-${dateStr}-${randomStr}`;

      const { error: ticketError } = await (supabase as any)
        .from("platform_support_tickets")
        .insert([{
          ...ticketForm,
          ticket_number: ticketNumber,
          company_id: currentCompany.id,
          created_by: user.id,
        }]);

      if (ticketError) throw ticketError;

      // El trigger de BD se encargará de notificar a los admins
      // y la función Edge enviará emails
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
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-support-messages"] });
      setNewMessage("");
      toast.success("Mensaje enviado");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar mensaje");
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      open: { variant: "default", label: "Abierto", icon: AlertCircle },
      in_progress: { variant: "secondary", label: "En Progreso", icon: Clock },
      pending: { variant: "outline", label: "Pendiente", icon: Clock },
      resolved: { variant: "default", label: "Resuelto", icon: CheckCircle2 },
      closed: { variant: "outline", label: "Cerrado", icon: CheckCircle2 },
    };
    return variants[status] || variants.open;
  };

  const stats = {
    open: tickets?.filter((t) => t.status === "open").length || 0,
    inProgress: tickets?.filter((t) => t.status === "in_progress").length || 0,
    resolved: tickets?.filter((t) => t.status === "resolved").length || 0,
    total: tickets?.length || 0,
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <LifeBuoy className="h-8 w-8" />
              Soporte de Plataforma
            </h1>
            <p className="text-muted-foreground">
              ¿Tienes problemas o necesitas ayuda? Crea un ticket y te ayudaremos
            </p>
          </div>
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
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

                <div className="flex justify-end gap-2 pt-4">
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

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
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
                  tickets.map((ticket: any) => {
                    const statusInfo = getStatusBadge(ticket.status);
                    const StatusIcon = statusInfo.icon;
                    return (
                      <div
                        key={ticket.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedTicket?.id === ticket.id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium">
                              {ticket.ticket_number}
                            </span>
                            <Badge variant={statusInfo.variant}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
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
                      </div>
                    );
                  })
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
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-lg">{selectedTicket.ticket_number}</CardTitle>
                      <Badge variant={getStatusBadge(selectedTicket.status).variant}>
                        {getStatusBadge(selectedTicket.status).label}
                      </Badge>
                    </div>
                    <CardDescription>{selectedTicket.subject}</CardDescription>
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
      </div>
    </Layout>
  );
}
