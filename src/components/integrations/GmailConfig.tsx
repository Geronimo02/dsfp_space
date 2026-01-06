import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import gmailClient, { GmailCredentials } from "@/integrations/gmail";

type Props = {
  integrationId: string;
  onSaved?: () => void;
};

export const GmailConfig: React.FC<Props> = ({ integrationId, onSaved }) => {
  const [clientId, setClientId] = useState<string>("");
  // Do not prefill the secret value; only allow setting/updating
  const [clientSecret, setClientSecret] = useState<string>("");
  const [hasSecret, setHasSecret] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealSecret, setRevealSecret] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const creds: GmailCredentials | null = await gmailClient.getGmailCredentials(integrationId);
        if (!mounted) return;
        if (creds) {
          setClientId(creds.clientId ?? "");
          setHasSecret(creds.hasClientSecret ?? false);
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "No se pudieron cargar las credenciales");
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [integrationId]);

  const onSave = async () => {
    if (!integrationId) return toast.error("Falta integrationId");

    // Basic client-side validation
    if (!clientId || clientId.trim() === "") return toast.error("El Client ID no puede estar vacío");
    if (clientSecret && clientSecret.length > 0 && clientSecret.length < 16)
      return toast.error("El Client Secret debe tener al menos 16 caracteres");

    setLoading(true);
    try {
      await gmailClient.saveGmailCredentials(integrationId, {
        clientId: clientId || null,
        // only send secret if user provided one
        clientSecret: clientSecret && clientSecret.length > 0 ? clientSecret : null,
      });
      toast.success("Credenciales guardadas");
      setHasSecret(true);
      setClientSecret("");
      onSaved?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "No se pudieron guardar las credenciales");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">

      <div>
        <label className="block text-sm font-medium text-muted-foreground">Client ID</label>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          placeholder="Ingrese Client ID de Google"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted-foreground">Client Secret</label>
        <div className="mt-1 flex gap-2">
          <input
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            type={revealSecret ? "text" : "password"}
            className="flex-1 rounded-md border px-3 py-2"
            placeholder={hasSecret ? "Secret configurado (dejar vacío para no cambiar)" : "Ingrese Client Secret de Google"}
            aria-label="Client Secret"
          />
          <Button variant="outline" onClick={() => setRevealSecret((s) => !s)}>
            {revealSecret ? "Ocultar" : "Mostrar"}
          </Button>
        </div>
        {hasSecret === true && (
          <p className="text-sm text-muted-foreground mt-1">Secret ya configurado en servidor — dejar vacío para no cambiarlo.</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={loading}>
          Guardar
        </Button>
      </div>
    </div>
  );
};

export default GmailConfig;
