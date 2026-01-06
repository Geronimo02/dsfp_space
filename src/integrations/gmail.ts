import { supabase } from "@/integrations/supabase/client";

export type GmailCredentials = {
  clientId: string | null;
  // Do NOT expose the secret value from the server; only indicate presence
  hasClientSecret: boolean;
};

export async function getGmailCredentials(integrationId: string): Promise<GmailCredentials | null> {
  const { data, error } = await supabase.functions.invoke("integrations-get-credentials", {
    body: { integrationId },
  });

  if (error) throw error;

  // The edge function should return an object with stored credentials metadata, e.g. { gmail: { clientId, hasClientSecret } }
  const creds = (data as any)?.gmail ?? null;
  if (!creds) return null;
  return {
    clientId: creds.clientId ?? null,
    hasClientSecret: Boolean(creds.hasClientSecret),
  };
}

export async function saveGmailCredentials(integrationId: string, creds: { clientId?: string | null; clientSecret?: string | null }) {
  // Ensure user session exists before attempting to save
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("No active session");

  const { error } = await supabase.functions.invoke("integrations-save-credentials", {
    body: { integrationId, type: "gmail", credentials: creds },
  });

  if (error) throw error;
  return true;
}

export default {
  getGmailCredentials,
  saveGmailCredentials,
};
