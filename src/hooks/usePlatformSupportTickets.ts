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
        return data as PlatformSupportTicket[];
      } catch (error) {
        console.error("Error fetching support tickets:", error);
        throw error;
      }
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
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
      // Validar status
      const validStatuses: TicketStatus[] = ["open", "in_progress", "pending", "resolved", "closed"];
      if (!validStatuses.includes(status)) {
        throw new Error(`Estado inválido: ${status}`);
      }

      const updates: any = { 
        status,
        updated_at: new Date().toISOString(),
      };
      
      // FIX: Usar now() de Supabase para timestamp del servidor
      if (status === "resolved") 
        updates.resolved_at = new Date().toISOString();
      if (status === "closed") 
        updates.closed_at = new Date().toISOString();

      // FIX: Una sola query con select + actualizar
      const { data, error } = await supabase
        .from("platform_support_tickets")
        .update(updates)
        .eq("id", ticketId)
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
        .single();

      if (error) throw error;
      return data as PlatformSupportTicket;
    },
    onMutate: async ({ ticketId, status }) => {
      // FIX: Optimistic update - actualizar UI inmediatamente
      const previousTickets = queryClient.getQueryData<PlatformSupportTicket[]>([
        "platform-support-tickets",
      ]);

      if (previousTickets) {
        const optimisticTickets = previousTickets.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, status } : ticket
        );
        
        queryClient.setQueryData(["platform-support-tickets"], optimisticTickets);
      }

      return { previousTickets };
    },
    onSuccess: (updatedTicket) => {
      if (!isMountedRef.current) return;
      
      toast.success("Estado actualizado");
      
      // FIX: Solo invalidar si es necesario (actualizar cache en lugar de refetch)
      queryClient.setQueryData(
        ["platform-support-tickets"],
        (old: PlatformSupportTicket[] | undefined) =>
          old?.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
      );

      options?.onTicketStatusUpdate?.(updatedTicket);
    },
    onError: (error: any, _variables, context: any) => {
      if (!isMountedRef.current) return;
      
      // Revertir optimistic update si falla
      if (context?.previousTickets) {
        queryClient.setQueryData(["platform-support-tickets"], context.previousTickets);
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
  };
}
