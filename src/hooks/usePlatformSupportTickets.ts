import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

export interface PlatformSupportTicket {
  id: string;
  ticket_number: string;
  company_id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "pending" | "resolved" | "closed";
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
  first_response_at?: string;
  sla_response_hours?: number;
  sla_resolution_hours?: number;
  sla_response_breached?: boolean;
  sla_resolution_breached?: boolean;
  waiting_for_customer?: boolean;
  waiting_since?: string;
  escalated_at?: string;
  escalated_to?: string;
  auto_priority_reason?: string;
  subscription_plan?: string;
  companies?: {
    name: string;
    email?: string;
    phone?: string;
    whatsapp_number?: string;
  };
}

export type TicketStatus = PlatformSupportTicket["status"];

interface UsePlatformSupportTicketsOptions {
  onTicketStatusUpdate?: (ticket: PlatformSupportTicket) => void;
  selectedTicketId?: string;
}

export function usePlatformSupportTickets(options?: UsePlatformSupportTicketsOptions) {
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  const isMutatingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch all support tickets with optimized caching
  const {
    data: platformSupportTickets,
    isLoading: platformTicketsLoading,
    error: platformTicketsError,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: ["platform-support-tickets"],
    queryFn: async () => {
      console.log("🔍 [Query] Fetching tickets from DB...");
      try {
        const { data, error } = await supabase
          .from("platform_support_tickets")
          .select(
            `
            *,
            companies!platform_support_tickets_company_id_fkey (
              name,
              email,
              phone,
              whatsapp_number
            )
          `
          )
          .order("created_at", { ascending: false });

        if (error) throw error;
        console.log("🔍 [Query] Tickets fetched from DB:", data?.map(t => ({ id: t.id.slice(0,8), status: t.status, ticket_number: t.ticket_number })));
        return data as PlatformSupportTicket[];
      } catch (error) {
        console.error("Error fetching support tickets:", error);
        throw error;
      }
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false, // Deshabilitado para evitar sobrescribir cambios optimistas
    refetchOnMount: true, // Refetch al montar para datos frescos
  });

  // Fetch messages para ticket específico - FIX: Incluir ticketId en queryKey
  const {
    data: platformTicketMessages,
  } = useQuery({
    queryKey: ["platform-ticket-messages", options?.selectedTicketId],
    queryFn: async () => {
      if (!options?.selectedTicketId) return [];
      
      const { data, error } = await supabase
        .from("platform_support_messages")
        .select("*")
        .eq("ticket_id", options.selectedTicketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!options?.selectedTicketId,
    staleTime: 10 * 1000, // 10 segundos
  });

  // Mutation to respond to a ticket
  const respondPlatformTicketMutation = useMutation({
    mutationFn: async ({
      ticketId,
      message,
    }: {
      ticketId: string;
      message: string;
    }) => {
      if (!ticketId || !message.trim()) 
        throw new Error("Ticket ID y mensaje son requeridos");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error } = await supabase
        .from("platform_support_messages")
        .insert([
          {
            ticket_id: ticketId,
            sender_type: "admin",
            sender_id: user.id,
            message: message,
          },
        ]);

      if (error) throw error;

      try {
        const { error: notifyError } = await supabase.functions.invoke(
          "notify-platform-support-ticket",
          {
            body: {
              ticket_id: ticketId,
              type: "message_received",
              send_email: true,
              send_whatsapp: true,
            },
          }
        );

        if (notifyError) {
          console.error("❌ [Ticket Update] Error notificando respuesta:", notifyError);
        }
      } catch (notifyException) {
        console.error("❌ [Ticket Update] Error llamando edge function:", notifyException);
      }
      return { ticketId };
    },
    onSuccess: () => {
      if (!isMountedRef.current) return;
      
      queryClient.invalidateQueries({
        queryKey: ["platform-ticket-messages"],
        refetchType: "active",
      });
      toast.success("Respuesta enviada");
    },
    onError: (error: any) => {
      if (!isMountedRef.current) return;
      toast.error(error.message || "Error al enviar respuesta");
    },
  });

  // Mutation to update ticket status - FIX: Combinar en 1 query + Optimistic Update
  const updatePlatformTicketStatusMutation = useMutation({
    mutationFn: async ({
      ticketId,
      status,
    }: {
      ticketId: string;
      status: TicketStatus;
    }) => {
      isMutatingRef.current = true;
      console.log("🎫 [Ticket Update] Iniciando actualización:", { ticketId, status });
      
      // Validar status
      const validStatuses: TicketStatus[] = ["open", "in_progress", "pending", "resolved", "closed"];
      if (!validStatuses.includes(status)) {
        console.error("❌ [Ticket Update] Estado inválido:", status);
        throw new Error(`Estado inválido: ${status}`);
      }

      const updates: any = { 
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (status === "resolved") 
        updates.resolved_at = new Date().toISOString();
      if (status === "closed") 
        updates.closed_at = new Date().toISOString();

      console.log("📝 [Ticket Update] Updates a aplicar:", updates);

      let data: PlatformSupportTicket | undefined;
      
      // Intentar usar Edge Function primero (más seguro con service role)
      try {
        const { data: functionResult, error: functionError } = await supabase.functions.invoke(
          "update-platform-support-ticket-status",
          {
            body: {
              ticket_id: ticketId,
              status,
            },
          }
        );

        if (!functionError && functionResult?.ticket) {
          data = functionResult.ticket as PlatformSupportTicket;
          console.log("✅ [Ticket Update] Edge Function exitosa");
        } else {
          console.warn("⚠️ [Ticket Update] Edge Function falló, usando método directo:", functionError);
          throw functionError; // Forzar fallback
        }
      } catch (functionException) {
        console.log("⚠️ [Ticket Update] Usando fallback - actualización directa");
        
        // Fallback: actualizar directamente (puede revertir con RLS pero es mejor que nada)
        const { error: updateError } = await supabase
          .from("platform_support_tickets")
          .update(updates)
          .eq("id", ticketId);

        if (updateError) {
          console.error("❌ [Ticket Update] Error en UPDATE directo:", updateError);
          throw updateError;
        }
        
        const { data: directData, error: selectError } = await supabase
          .from("platform_support_tickets")
          .select(
            `
            *,
            companies!platform_support_tickets_company_id_fkey (
              name,
              email,
              phone,
              whatsapp_number
            )
          `
          )
          .eq("id", ticketId)
          .single();

        if (selectError || !directData) {
          console.error("❌ [Ticket Update] Error en SELECT:", selectError);
          throw selectError || new Error("No se pudo obtener el ticket actualizado");
        }
        
        data = directData as any as PlatformSupportTicket;
      }

      if (!data) {
        console.error("❌ [Ticket Update] No se obtuvo dato final");
        throw new Error("No se pudo obtener el ticket actualizado");
      }

      try {
        const { error: notifyError } = await supabase.functions.invoke(
          "notify-platform-support-ticket",
          {
            body: {
              ticket_id: ticketId,
              type: "status_changed",
              send_email: true,
              send_whatsapp: true,
            },
          }
        );

        if (notifyError) {
          console.error("❌ [Ticket Update] Error notificando cambio de estado:", notifyError);
        }
      } catch (notifyException) {
        console.error("❌ [Ticket Update] Error llamando edge function:", notifyException);
      }
      
      console.log("✅ [Ticket Update] Ticket actualizado exitosamente:", data);
      return data as PlatformSupportTicket;
    },
    onMutate: async ({ ticketId, status }) => {
      console.log("🔄 [Optimistic Update] Aplicando actualización optimista:", { ticketId, status });
      
      // Cancelar cualquier refetch en progreso para evitar race conditions
      await queryClient.cancelQueries({ queryKey: ["platform-support-tickets"] });
      
      // Guardar el estado anterior para rollback
      const previousTickets = queryClient.getQueryData<PlatformSupportTicket[]>([
        "platform-support-tickets",
      ]);

      if (previousTickets) {
        // Aplicar optimistic update inmediatamente
        const optimisticTickets = previousTickets.map((ticket) =>
          ticket.id === ticketId 
            ? { ...ticket, status, updated_at: new Date().toISOString() } 
            : ticket
        );
        
        queryClient.setQueryData(["platform-support-tickets"], optimisticTickets);
        console.log("✅ [Optimistic Update] Cache actualizado optimísticamente");
      } else {
        console.warn("⚠️ [Optimistic Update] No hay tickets previos en cache");
      }

      return { previousTickets };
    },
    onSuccess: (updatedTicket) => {
      if (!isMountedRef.current) {
        console.warn("⚠️ [Ticket Update] Componente desmontado, cancelando callbacks");
        return;
      }
      
      console.log("🎉 [Ticket Update] onSuccess - ticket actualizado:", {
        ticketId: updatedTicket.id?.slice(0,8),
        status: updatedTicket.status,
        updated_at: updatedTicket.updated_at
      });
      
      // Actualizar cache con datos reales del servidor
      queryClient.setQueryData(
        ["platform-support-tickets"],
        (old: PlatformSupportTicket[] | undefined) => {
          const updated = old?.map((t) => (t.id === updatedTicket.id ? updatedTicket : t));
          console.log("📝 [onSuccess] Cache after setQueryData:", updated?.map(t => ({ 
            id: t.id?.slice(0,8), 
            status: t.status 
          })));
          return updated;
        }
      );

      console.log("✅ [Ticket Update] Cache actualizado con datos reales, llamando callback...");
      options?.onTicketStatusUpdate?.(updatedTicket);
      
      toast.success("Estado actualizado");
      
      // Desbloquear realtime inmediatamente después del update exitoso
      setTimeout(() => {
        console.log("🔓 [Ticket Update] Desbloqueando realtime (timeout 500ms)");
        isMutatingRef.current = false;
      }, 500); // 500ms de bloqueo para evitar race conditions
    },
    onError: (error: any, _variables, context: any) => {
      isMutatingRef.current = false;
      if (!isMountedRef.current) return;
      
      console.error("❌ [Ticket Update] Error en mutación:", {
        error: error.message,
        details: error,
        variables: _variables,
        context
      });
      
      // Revertir optimistic update si falla
      if (context?.previousTickets) {
        queryClient.setQueryData(["platform-support-tickets"], context.previousTickets);
        console.log("🔄 [Ticket Update] Rollback de optimistic update aplicado");
      }
      
      toast.error(error.message || "Error al actualizar el estado del ticket");
    },
  });

  return {
    // Queries
    platformSupportTickets,
    platformTicketsLoading,
    platformTicketsError,
    platformTicketMessages,

    // Mutations
    respondPlatformTicketMutation,
    updatePlatformTicketStatusMutation,

    // Utilities
    refetchTickets,
    isMutatingRef, // Para bloquear realtime durante mutaciones
  };
}
