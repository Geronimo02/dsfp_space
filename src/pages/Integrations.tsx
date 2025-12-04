import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useMemo, useState, useEffect} from "react";
import { Settings, ShoppingCart, Store, FileText, BarChart3 } from "lucide-react";

type IntegrationType = "mercadolibre" | "tiendanube" | "woocommerce" | "google_forms";

type IntegrationRow = {
  id: string;
  company_id: string;
  integration_type: string;
  name: string | null;
  active: boolean;
  config: any;
  last_sync_at: string | null;
  sync_frequency: string | null;
  auto_invoice: boolean | null;
  auto_email: boolean | null;
  created_at: string;
  updated_at: string;
};

type IntegrationOrderRow = {
  id: string;
  external_order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string | null;
  created_at: string;
  integrations?: { integration_type?: string | null; name?: string | null } | null;
};

type ConfigModalState =
  | { open: false }
  | { open: true; type: "google_forms"; integrationId: string; integrationName: string };

const genSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const getFunctionsBaseUrl = () => {
  // Vite: VITE_SUPABASE_URL
  const url =
    (import.meta as any)?.env?.VITE_SUPABASE_URL ||
    (import.meta as any)?.env?.PUBLIC_SUPABASE_URL ||
    "";
  return url ? `${String(url).replace(/\/$/, "")}/functions/v1` : "";
};

const buildGoogleFormsWebhookUrl = () => {
  const base = getFunctionsBaseUrl();
  // Debe existir esta edge function: webhooks-google-forms
  return base ? `${base}/webhooks-google-forms` : "";
};

const buildAppsScript = (webhookUrl: string, secret: string) => `
// 1) Google Form → Responses → Link to Sheets
// 2) En la Sheet: Extensions → Apps Script
// 3) Pegá este código
// 4) Triggers → Add Trigger:
//    function: onFormSubmit
//    event source: From spreadsheet
//    event type: On form submit
// 5) Autorizar permisos y probar enviando una respuesta

const WEBHOOK_URL = "${webhookUrl}";
const WEBHOOK_SECRET = "${secret}";

function onFormSubmit(e) {
  const payload = {
    secret: WEBHOOK_SECRET,
    submittedAt: new Date().toISOString(),
    namedValues: e && e.namedValues ? e.namedValues : {},
    values: e && e.values ? e.values : [],
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const res = UrlFetchApp.fetch(WEBHOOK_URL, options);
  Logger.log(res.getContentText());
}
`.trim();

async function copyToClipboard(text: string, label: string) {
  await navigator.clipboard.writeText(text);
  toast.success(`${label} copiado`);
}

const Integrations = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const companyId = currentCompany?.id ?? null;

  // ---- Modal Google Forms (UX “usuario normal”)
  const [configModal, setConfigModal] = useState<ConfigModalState>({ open: false });
  const [gfWebhookUrl, setGfWebhookUrl] = useState<string>("");
  const [gfSecret, setGfSecret] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState<boolean>(true);

  useEffect(() => {
  if (configModal.open && configModal.type === "google_forms") {
    const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    if (base) {
      setGfWebhookUrl(`${base}/functions/v1/webhooks-google-forms?integrationId=${configModal.integrationId}`);
    }
    setGfSecret((prev) => prev || genSecret());
    setShowInstructions(true);
  }
}, [configModal]);


  const appsScript = useMemo(
    () => buildAppsScript(gfWebhookUrl, gfSecret),
    [gfWebhookUrl, gfSecret]
  );

  const integrationTypes = useMemo(
    () => [
      {
        type: "mercadolibre" as const,
        name: "Mercado Libre",
        icon: ShoppingCart,
        description: "Sincroniza pedidos y genera facturas automáticamente",
      },
      {
        type: "tiendanube" as const,
        name: "Tienda Nube",
        icon: Store,
        description: "Conecta tu tienda online con tu sistema",
      },
      {
        type: "woocommerce" as const,
        name: "WooCommerce",
        icon: Store,
        description: "Integración con tu tienda WordPress",
      },
      {
        type: "google_forms" as const,
        name: "Google Forms",
        icon: FileText,
        description: "Crea clientes y presupuestos desde formularios",
      },
    ],
    []
  );

  // ---- Queries
  const { data: integrations, isLoading: isLoadingIntegrations } = useQuery({
    queryKey: ["integrations", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("integrations")
        .select(
          "id, company_id, integration_type, name, active, config, last_sync_at, sync_frequency, auto_invoice, auto_email, created_at, updated_at"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as IntegrationRow[];
    },
  });

  const { data: integrationOrders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["integration_orders", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("integration_orders")
        .select(
          `
          id,
          external_order_id,
          customer_name,
          customer_email,
          status,
          created_at,
          integrations (
            integration_type,
            name
          )
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data ?? []) as IntegrationOrderRow[];
    },
  });

  // ---- Mutations
  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("integrations").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });
      toast.success("Integración actualizada");
    },
    onError: () => toast.error("Error al actualizar la integración"),
  });

  // ---- Helpers
  const getIntegrationStatus = (type: IntegrationType) => {
    return (integrations ?? []).find((i) => i.integration_type === type) ?? null;
  };

  /**
   * IMPORTANT:
   * This requires a UNIQUE constraint on (company_id, integration_type) to avoid duplicates:
   *  alter table public.integrations add constraint integrations_company_type_unique unique (company_id, integration_type);
   */
  const ensureIntegrationRow = async (type: IntegrationType) => {
    if (!companyId) throw new Error("No companyId");
    const { data, error } = await supabase
      .from("integrations")
      .upsert(
        {
          company_id: companyId,
          integration_type: type,
          name: type,
          active: false,
          config: {},
          auto_invoice: false,
          auto_email: false,
        },
        { onConflict: "company_id,integration_type" }
      )
      .select(
        "id, company_id, integration_type, name, active, config, last_sync_at, sync_frequency, auto_invoice, auto_email, created_at, updated_at"
      )
      .single();

    if (error) throw error;

    // refresh list to reflect newly created row
    queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });

    return data as IntegrationRow;
  };

  const onConfigure = async (type: IntegrationType) => {
    try {
      const row = await ensureIntegrationRow(type);


      // OAuth flows (need edge function "integrations-start")
      if (type === "mercadolibre" || type === "tiendanube") {
        const { data, error } = await supabase.functions.invoke("integrations-start", {
          body: { integrationId: row.id, type },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("No URL de autorización (falta configurar OAuth)");
        window.location.href = data.url;
        return;
      }

      // WooCommerce: implement modal later if you want (keys)
      if (type === "woocommerce") {
        toast.info("WooCommerce: falta agregar modal de keys (storeUrl, consumerKey, consumerSecret).");
        return;
      }

      // Google Forms: open friendly modal with copy/paste instructions
      if (type === "google_forms") {
        setConfigModal({
          open: true,
          type: "google_forms",
          integrationId: row.id,
          integrationName: row.name ?? "Google Forms",
        });
        return;
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "No se pudo iniciar la configuración");
    }
  };

  // ---- Google Forms actions (needs edge functions)
  const saveGoogleFormsCredentials = async () => {
    if (!companyId) return toast.error("No hay companyId");
    if (!gfSecret || gfSecret.length < 16) return toast.error("El secret debe tener al menos 16 caracteres");
    if (!gfWebhookUrl) return toast.error("No se pudo armar el webhook URL (revisá VITE_SUPABASE_URL)");
    if (!configModal.open) return;

    try {
      // 1) Store secret securely (integration_credentials). Requires edge function.
      const { error: fnErr } = await supabase.functions.invoke("integrations-save-credentials", {
        body: {
          integrationId: configModal.integrationId,
          type: "google_forms",
          credentials: { webhookSecret: gfSecret },
        },
      });
      if (fnErr) throw fnErr;

      // 2) Store NON-sensitive config (webhookUrl) for UI display
      const { error: upErr } = await supabase
        .from("integrations")
        .update({
          config: { googleForms: { webhookUrl: gfWebhookUrl } },
        })
        .eq("id", configModal.integrationId);

      if (upErr) throw upErr;

      toast.success("Google Forms configurado (secret guardado)");
      queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });
      setConfigModal({ open: false });
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.message ??
          "No se pudo guardar. Probable: falta deploy de la Edge Function integrations-save-credentials"
      );
    }
  };

 const verifyGoogleFormsWebhook = async () => {
  try {
    const { data, error } = await supabase.functions.invoke("webhooks-google-forms", {
      body: { _ping: true },
    });

    if (error) throw error;
    toast.success(data?.message ?? "Endpoint OK");
  } catch (e: any) {
    console.error(e);
    toast.error(e?.message ?? "No se pudo verificar el endpoint");
  }
};



  if (isLoadingIntegrations) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Integraciones</h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted" />
                <CardContent className="h-32 bg-muted/50" />
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Integraciones</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {integrationTypes.map((integration) => {
            const status = getIntegrationStatus(integration.type);
            const Icon = integration.icon;

            return (
              <Card key={integration.type}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        {status ? (
                          <Badge variant={status.active ? "default" : "secondary"} className="mt-1">
                            {status.active ? "Activo" : "Inactivo"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-1">
                            No configurada
                          </Badge>
                        )}
                      </div>
                    </div>

                    {status && (
                      <Switch
                        checked={status.active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: status.id, active: checked })
                        }
                      />
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  <CardDescription className="mb-4">{integration.description}</CardDescription>

                  {!status ? (
                    <Button variant="outline" className="w-full" onClick={() => onConfigure(integration.type)}>
                      Configurar
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        size="sm"
                        onClick={() => toast.info("Logs: conectá integration_logs acá cuando los tengas")}
                      >
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Ver Logs
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        size="sm"
                        onClick={() => onConfigure(integration.type)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Configuración
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(integrations?.length ?? 0) > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pedidos Sincronizados</CardTitle>
              <CardDescription>Últimos pedidos recibidos desde las integraciones</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOrders ? (
                <div className="text-center text-muted-foreground py-8">Cargando pedidos...</div>
              ) : (integrationOrders?.length ?? 0) > 0 ? (
                <div className="space-y-3">
                  {integrationOrders!.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {o.customer_name || "Cliente sin nombre"}{" "}
                          <span className="text-muted-foreground">· #{o.external_order_id ?? "s/n"}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {o.integrations?.name || o.integrations?.integration_type || "Integración"}
                          {o.customer_email ? ` · ${o.customer_email}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {o.created_at ? new Date(o.created_at).toLocaleString() : ""}
                        </div>
                      </div>
                      <Badge variant={o.status === "processed" ? "default" : "secondary"}>
                        {o.status || "unknown"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">No hay pedidos sincronizados aún</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ---------------- Google Forms Modal (auto URL + auto secret) ---------------- */}
{configModal.open && configModal.type === "google_forms" && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="w-full max-w-2xl rounded-2xl bg-background shadow-lg border max-h-[85vh] overflow-y-auto">
      {/* header */}
      <div className="p-5 flex items-start justify-between gap-4 border-b">
        <div>
          <div className="text-xl font-semibold">Conectar Google Forms</div>
          <div className="text-sm text-muted-foreground mt-1">
            Copiá y pegá. Esto conecta tu Form con RetailSnap sin OAuth.
          </div>
        </div>
        <Button variant="outline" onClick={() => setConfigModal({ open: false })}>
          Cerrar
        </Button>
      </div>

      {/* body */}
      <div className="p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1) Webhook URL</CardTitle>
              <CardDescription>
                Ya viene lista (incluye tu <b>integrationId</b>). Solo copiá y pegá.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <input
                className="w-full rounded-md border bg-muted px-3 py-2 text-sm"
                value={gfWebhookUrl}
                readOnly
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => copyToClipboard(gfWebhookUrl, "Webhook URL")}
                disabled={!gfWebhookUrl}
              >
                Copiar Webhook URL
              </Button>
              <div className="text-xs text-muted-foreground">
                Esta URL es única para tu empresa/integración.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2) Secret</CardTitle>
              <CardDescription>
                Se genera automáticamente. Sirve para que nadie mande data falsa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <input
                className="w-full rounded-md border bg-muted px-3 py-2 text-sm"
                value={gfSecret}
                readOnly
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => copyToClipboard(gfSecret, "Secret")}
                  disabled={!gfSecret}
                >
                  Copiar Secret
                </Button>
                <Button variant="outline" onClick={() => setGfSecret(genSecret())}>
                  Regenerar
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Si regenerás el secret, el script viejo deja de funcionar.
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-base font-semibold">3) Código Apps Script</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowInstructions((s) => !s)}>
                {showInstructions ? "Ocultar instrucciones" : "Ver instrucciones"}
              </Button>
              <Button variant="outline" onClick={() => copyToClipboard(appsScript, "Código Apps Script")}>
                Copiar código
              </Button>
            </div>
          </div>

          {showInstructions && (
            <div className="mt-3 rounded-xl border p-3 text-sm text-muted-foreground space-y-2">
              <div>
                <b>Pasos rápidos:</b>
              </div>
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  En tu Google Form: <b>Responses</b> → <b>Link to Sheets</b>.
                </li>
                <li>
                  En la Sheet: <b>Extensions → Apps Script</b>.
                </li>
                <li>Pegá el código (botón “Copiar código”).</li>
                <li>
                  En Apps Script: <b>Triggers</b> → Add Trigger (onFormSubmit / From spreadsheet / On form submit).
                </li>
                <li>Google te pedirá autorización la primera vez.</li>
                <li>Probá enviando una respuesta al Form.</li>
              </ol>
            </div>
          )}

          <textarea
            className="mt-3 w-full min-h-[180px] md:min-h-[220px] rounded-xl border bg-background p-3 font-mono text-xs"
            value={appsScript}
            readOnly
          />
        </div>

        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end pt-2">
          <Button variant="outline" onClick={verifyGoogleFormsWebhook}>
            Verificar endpoint
          </Button>
          <Button onClick={saveGoogleFormsCredentials}>Guardar integración</Button>
        </div>

        <div className="text-xs text-muted-foreground">
          <div>
            “Guardar integración” requiere deploy de <b>integrations-save-credentials</b>.
          </div>
          <div>
            “Verificar endpoint” requiere deploy de <b>webhooks-google-forms</b>.
          </div>
        </div>
      </div>
    </div>
  </div>
)}


    </Layout>
  );
};

export default Integrations;