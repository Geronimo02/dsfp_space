import { useEffect, useRef, useCallback } from "react";
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

interface AdminRealtimeOptions {
  enabled?: boolean;
  onNewTicket?: (ticket: RealtimeTicket) => void;
  onTicketUpdate?: (ticket: RealtimeTicket) => void;
  onNewMessage?: (message: RealtimeMessage) => void;
  isMutatingRef?: React.MutableRefObject<boolean>;
}

export function usePlatformAdminRealtime({
  enabled = true,
  onNewTicket,
  onTicketUpdate,
  onNewMessage,
  isMutatingRef,
}: AdminRealtimeOptions = {}) {
  const queryClient = useQueryClient();

  // Stabilize callbacks with refs to avoid re-subscribing on every render
  const onNewTicketRef = useRef(onNewTicket);
  onNewTicketRef.current = onNewTicket;
  const onTicketUpdateRef = useRef(onTicketUpdate);
  onTicketUpdateRef.current = onTicketUpdate;
  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

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
        async (payload) => {
          logger.debug("[Realtime] Ticket change received:", payload.eventType);

          // Durante mutaciones activas, ignorar completamente los eventos realtime
          // El cache ya fue actualizado por el optimistic update y onSuccess
          if (isMutatingRef?.current) {
            logger.debug("[Realtime] Evento BLOQUEADO - mutación activa");
            return;
          }

          if (payload.eventType === "INSERT") {
            // Fetch full ticket with companies relation for new tickets
            try {
              const { data: fullTicket } = await supabase
                .from("platform_support_tickets")
                .select(`
                  *,
                  companies!platform_support_tickets_company_id_fkey (
                    name,
                    email,
                    phone,
                    whatsapp_number
                  )
                `)
                .eq("id", (payload.new as any).id)
                .single();
              
              if (fullTicket) {
                // Agregar el nuevo ticket al cache directamente
                queryClient.setQueryData(
                  ["platform-support-tickets"],
                  (old: any[] | undefined) => old ? [fullTicket, ...old] : [fullTicket]
                );
                
                toast.info(`Nuevo ticket: ${fullTicket.ticket_number}`, {
                  description: fullTicket.subject?.substring(0, 50),
                  duration: 5000,
                });
                onNewTicketRef.current?.(fullTicket);
              }
            } catch (error) {
              logger.error("[Realtime] Error fetching full ticket:", error);
              // Fallback: invalidar queries para forzar refetch
              queryClient.invalidateQueries({
                queryKey: ["platform-support-tickets"],
              });
            }
          }

          if (payload.eventType === "UPDATE") {
            const updatedData = payload.new as any;
            logger.debug("[Realtime UPDATE] Processing update");
            
            // Fetch full ticket with companies relation to ensure complete data
            try {
              const { data: fullTicket } = await supabase
                .from("platform_support_tickets")
                .select(`
                  *,
                  companies!platform_support_tickets_company_id_fkey (
                    name,
                    email,
                    phone,
                    whatsapp_number
                  )
                `)
                .eq("id", updatedData.id)
                .single();
              
              if (fullTicket) {
                logger.debug("[Realtime UPDATE] Full ticket fetched");
                
                // Verificar si el update es más reciente que el cache actual
                const currentTickets = queryClient.getQueryData<any[]>(["platform-support-tickets"]);
                const currentTicket = currentTickets?.find(t => t.id === fullTicket.id);
                
                if (currentTicket && currentTicket.updated_at) {
                  const currentTime = new Date(currentTicket.updated_at).getTime();
                  const incomingTime = new Date(fullTicket.updated_at).getTime();
                  const timeDiff = incomingTime - currentTime;
                  
                  logger.debug("[Realtime] Timestamp comparison", {
                    currentStatus: currentTicket.status,
                    incomingStatus: fullTicket.status,
                    timeDiffMs: timeDiff,
                    willApply: timeDiff >= 0
                  });
                  
                  if (incomingTime < currentTime) {
                    logger.debug("[Realtime] Ignoring stale update");
                    return; // Ignorar updates obsoletos
                  }
                }
                
                // Actualizar el cache directamente sin invalidar
                logger.debug("[Realtime] Applying update to cache");
                queryClient.setQueryData(
                  ["platform-support-tickets"],
                  (old: any[] | undefined) => {
                    return old?.map((t: any) => t.id === fullTicket.id ? fullTicket : t) || [];
                  }
                );
                
                onTicketUpdateRef.current?.(fullTicket);
              }
            } catch (error) {
              logger.error("[Realtime] Error fetching full ticket on update:", error);
              // En caso de error, actualizar con datos parciales del payload
              queryClient.setQueryData(
                ["platform-support-tickets"],
                (old: any[] | undefined) => 
                  old?.map((t: any) => t.id === updatedData.id ? { ...t, ...updatedData } : t) || []
              );
              onTicketUpdateRef.current?.(updatedData);
            }
          }

          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              queryClient.setQueryData(
                ["platform-support-tickets"],
                (old: any[] | undefined) => old?.filter((t: any) => t.id !== deletedId) || []
              );
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
          logger.debug("[Realtime] Admin - New message received");

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

          onNewMessageRef.current?.(newMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [enabled, queryClient, isMutatingRef]);
}
