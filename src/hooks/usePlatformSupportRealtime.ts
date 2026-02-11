import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface RealtimeTicket {
  id: string;
  ticket_number: string;
  company_id: string;
  subject: string;
  status: string;
  priority: string;
  updated_at: string;
  [key: string]: unknown;
}

interface RealtimeMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_id: string;
  message: string;
  created_at: string;
  [key: string]: unknown;
}

interface RealtimeOptions {
  companyId?: string;
  ticketId?: string;
  onNewMessage?: (message: RealtimeMessage) => void;
  onTicketUpdate?: (ticket: RealtimeTicket) => void;
}

export function usePlatformSupportRealtime({
  companyId,
  ticketId,
  onNewMessage,
  onTicketUpdate,
}: RealtimeOptions) {
  const queryClient = useQueryClient();

  // Stabilize callbacks with refs to avoid re-subscribing on every render
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;
  const onTicketUpdateRef = useRef(onTicketUpdate);
  onTicketUpdateRef.current = onTicketUpdate;

  useEffect(() => {
    if (!companyId) return;

    // Subscribe to ticket changes
    const ticketChannel = supabase
      .channel(`platform-tickets-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "platform_support_tickets",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          logger.debug("[Realtime] Ticket change:", payload.eventType);
          
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ 
            queryKey: ["platform-support-tickets", companyId] 
          });
          queryClient.invalidateQueries({ 
            queryKey: ["platform-support-tickets-metrics", companyId] 
          });

          if (payload.eventType === "UPDATE") {
            const newData = payload.new as any;
            const oldData = payload.old as any;

            // Notify on status change
            if (oldData.status !== newData.status) {
              toast.info(`Ticket ${newData.ticket_number}: Estado cambiado a ${newData.status}`);
            }

            onTicketUpdateRef.current?.(newData);
          }
        }
      )
      .subscribe();

    // Subscribe to messages for the selected ticket
    let messageChannel: ReturnType<typeof supabase.channel> | null = null;

    if (ticketId) {
      messageChannel = supabase
        .channel(`platform-messages-${ticketId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "platform_support_messages",
            filter: `ticket_id=eq.${ticketId}`,
          },
          async (payload) => {
            logger.debug("[Realtime] New message received");
            
            // Invalidate messages query
            queryClient.invalidateQueries({ 
              queryKey: ["platform-support-messages", ticketId] 
            });

            const newMessage = payload.new as any;
            
            // Only notify for admin messages (responses)
            if (newMessage.sender_type === "admin") {
              toast.success("Nueva respuesta del equipo de soporte", {
                description: newMessage.message.substring(0, 100) + "...",
                duration: 5000,
              });
            }

            onNewMessageRef.current?.(newMessage);
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(ticketChannel);
      if (messageChannel) {
        supabase.removeChannel(messageChannel);
      }
    };
  }, [companyId, ticketId, queryClient]);
}
