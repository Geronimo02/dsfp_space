import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminRealtimeOptions {
  enabled?: boolean;
  onNewTicket?: (ticket: any) => void;
  onTicketUpdate?: (ticket: any) => void;
  onNewMessage?: (message: any) => void;
  isMutatingRef?: React.MutableRefObject<boolean>; // Para saber si hay mutación activa
}

export function usePlatformAdminRealtime({
  enabled = true,
  onNewTicket,
  onTicketUpdate,
  onNewMessage,
  isMutatingRef,
}: AdminRealtimeOptions = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    // Subscribe to ALL platform support tickets (no company filter for admins)
    const ticketChannel = supabase
      .channel("admin-platform-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_support_tickets",
        },
        (payload) => {
          console.log("🎫 Admin - Ticket change:", payload);

          // NO invalidar queries durante mutaciones activas para prevenir race conditions
          if (isMutatingRef?.current) {
            console.warn("⏸️ [Realtime] invalidateQueries bloqueado durante mutación");
            return;
          }

          // Invalidate queries to refresh data SOLO si no hay mutación activa
          queryClient.invalidateQueries({
            queryKey: ["platform-support-tickets"],
          });

          if (payload.eventType === "INSERT") {
            const newTicket = payload.new as any;
            toast.info(`Nuevo ticket: ${newTicket.ticket_number}`, {
              description: newTicket.subject?.substring(0, 50),
              duration: 5000,
            });
            onNewTicket?.(newTicket);
          }

          if (payload.eventType === "UPDATE") {
            const updatedTicket = payload.new as any;
            
            // NO llamar callback durante mutaciones para evitar sobrescribir optimistic update
            if (!isMutatingRef?.current) {
              onTicketUpdate?.(updatedTicket);
            } else {
              console.warn("⏸️ [Realtime] onTicketUpdate bloqueado durante mutación");
            }
          }
        }
      )
      .subscribe();

    // Subscribe to ALL platform support messages
    const messageChannel = supabase
      .channel("admin-platform-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "platform_support_messages",
        },
        (payload) => {
          console.log("💬 Admin - New message:", payload);

          const newMessage = payload.new as any;

          // Invalidate messages query for the ticket
          queryClient.invalidateQueries({
            queryKey: ["platform-ticket-messages", newMessage.ticket_id],
          });

          // Only notify for user messages (not admin responses)
          if (newMessage.sender_type === "user") {
            toast.info("Nuevo mensaje de empresa", {
              description: newMessage.message?.substring(0, 50) + "...",
              duration: 5000,
            });
          }

          onNewMessage?.(newMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [enabled, queryClient, onNewTicket, onTicketUpdate, onNewMessage, isMutatingRef]);
}
