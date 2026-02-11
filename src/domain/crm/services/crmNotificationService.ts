import { supabase } from "@/integrations/supabase/client";

type CRMNotificationType =
  | "crm_stage_changed"
  | "crm_auto_assign"
  | "crm_sla_assigned"
  | "crm_reminder_created";

interface CRMNotificationPayload {
  companyId: string;
  type: CRMNotificationType;
  title: string;
  message: string;
  data?: Record<string, any> | null;
  userIds?: string[];
}

type NotificationTarget = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  email_enabled: boolean | null;
};

export const crmNotificationService = {
  async notify(payload: CRMNotificationPayload) {
    const targets = await this.resolveTargets(payload);
    if (!targets.length) return;

    const notifications = targets.map((target) => ({
      user_id: target.user_id,
      company_id: payload.companyId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      data: payload.data ?? null,
    }));

    const results = await Promise.all(
      notifications.map((notification) =>
        supabase.rpc("create_notification" as any, {
          _user_id: notification.user_id,
          _company_id: notification.company_id,
          _type: notification.type,
          _title: notification.title,
          _message: notification.message,
          _data: notification.data,
        })
      )
    );

    const firstError = results.find((result) => result.error)?.error;
    if (firstError) throw firstError;

    const emailRecipients = targets
      .filter((target) => target.email_enabled && target.email)
      .map((target) => ({ email: target.email as string, name: target.full_name ?? "" }));

    if (emailRecipients.length) {
      const { error } = await supabase.functions.invoke("send-crm-notification", {
        body: {
          recipients: emailRecipients,
          subject: payload.title,
          message: payload.message,
        },
      });
      if (error) {
        console.error("CRM email notification failed", error);
      }
    }
  },

  async resolveTargets(payload: CRMNotificationPayload): Promise<NotificationTarget[]> {
    if (payload.userIds?.length) {
      const results: NotificationTarget[] = [];
      for (const userId of payload.userIds) {
        const { data, error } = await supabase.rpc("get_user_notification_target" as any, {
          _company_id: payload.companyId,
          _user_id: userId,
          _notification_type: payload.type,
        });
        if (error) throw error;
        const rows = (data as NotificationTarget[] | null) ?? [];
        if (rows[0]) results.push(rows[0]);
      }
      return results;
    }

    const { data, error } = await supabase.rpc("get_users_to_notify", {
      _company_id: payload.companyId,
      _notification_type: payload.type,
    });
    if (error) throw error;
    return (data ?? []) as NotificationTarget[];
  },
};
