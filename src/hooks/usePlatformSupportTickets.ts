import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCallback } from "react";

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

export function usePlatformSupportTickets() {
  const queryClient = useQueryClient();

  // Fetch all support tickets
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
  });

  // Fetch messages for a specific ticket
  const {
    data: platformTicketMessages,
  } = useQuery({
    queryKey: ["platform-ticket-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_support_messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
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
      queryClient.invalidateQueries({
        queryKey: ["platform-ticket-messages"],
      });
      toast.success("Respuesta enviada");
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al enviar respuesta");
    },
  });

  // Mutation to update ticket status
  const updatePlatformTicketStatusMutation = useMutation({
    mutationFn: async ({
      ticketId,
      status,
    }: {
      ticketId: string;
      status: string;
    }) => {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === "resolved")
        updates.resolved_at = new Date().toISOString();
      if (status === "closed") updates.closed_at = new Date().toISOString();

      // First do the update
      const { error: updateError } = await supabase
        .from("platform_support_tickets")
        .update(updates)
        .eq("id", ticketId);

      if (updateError) throw updateError;

      // Then fetch the updated data with relations
      const { data, error: fetchError } = await supabase
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

      if (fetchError) throw fetchError;
      return data as PlatformSupportTicket;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({
        queryKey: ["platform-support-tickets"],
        refetchType: "all",
      });
    },
    onError: (error: any) => {
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
