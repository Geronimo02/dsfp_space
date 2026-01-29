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
        async (payload) => {
          console.log("🎫 [Realtime] Ticket change received:", {
            eventType: payload.eventType,
            ticketId: (payload.new as any)?.id?.slice(0,8),
            newStatus: (payload.new as any)?.status,
            oldStatus: (payload.old as any)?.status,
            isMutating: isMutatingRef?.current
          });

          // Durante mutaciones activas, ignorar completamente los eventos realtime
          // El cache ya fue actualizado por el optimistic update y onSuccess
          if (isMutatingRef?.current) {
            console.warn("⏸️ [Realtime] Evento BLOQUEADO - mutación activa");
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
                onNewTicket?.(fullTicket);
              }
            } catch (error) {
              console.error("Error fetching full ticket:", error);
              // Fallback: invalidar queries para forzar refetch
              queryClient.invalidateQueries({
                queryKey: ["platform-support-tickets"],
              });
            }
          }

          if (payload.eventType === "UPDATE") {
            const updatedData = payload.new as any;
            console.log("🔄 [Realtime UPDATE] Processing update for ticket:", {
              ticketId: updatedData.id?.slice(0,8),
              newStatus: updatedData.status,
              isMutating: isMutatingRef?.current
            });
            
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
                console.log("✅ [Realtime UPDATE] Updating cache with full ticket:", {
                  ticketId: fullTicket.id?.slice(0,8),
                  status: fullTicket.status
                });
                // Actualizar el cache directamente sin invalidar
                queryClient.setQueryData(
                  ["platform-support-tickets"],
                  (old: any[] | undefined) => {
                    const updated = old?.map((t: any) => t.id === fullTicket.id ? fullTicket : t) || [];
                    console.log("📝 [Realtime UPDATE] Cache after update:", updated.map(t => ({ id: t.id?.slice(0,8), status: t.status })));
                    return updated;
                  }
                );
                
                onTicketUpdate?.(fullTicket);
              }
            } catch (error) {
              console.error("Error fetching full ticket on update:", error);
              // En caso de error, actualizar con datos parciales del payload
              queryClient.setQueryData(
                ["platform-support-tickets"],
                (old: any[] | undefined) => 
                  old?.map((t: any) => t.id === updatedData.id ? { ...t, ...updatedData } : t) || []
              );
              onTicketUpdate?.(updatedData);
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
