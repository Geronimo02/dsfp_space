import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useMemo, useState, useEffect } from "react";
import { Settings, ShoppingCart, Store, FileText, BarChart3, Clock } from "lucide-react";

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
  customer_phone: string | null;
  status: string | null;
  created_at: string;
  currency: string | null;
  total_amount: number | string | null;
  items_count: number | null;
  external_created_at: string | null;
  order_data: any;
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
  const url =
    (import.meta as any)?.env?.VITE_SUPABASE_URL || (import.meta as any)?.env?.PUBLIC_SUPABASE_URL || "";
  return url ? `${String(url).replace(/\/$/, "")}/functions/v1` : "";
};

function isGoogleFormsModal(
  m: ConfigModalState
): m is { open: true; type: "google_forms"; integrationId: string; integrationName: string } {
  return (m as any)?.open === true && (m as any)?.type === "google_forms";
}

const secretCacheKey = (integrationId: string) => `gf_secret_${integrationId}`;

const loadCachedSecret = (integrationId: string) => {
  try {
    return localStorage.getItem(secretCacheKey(integrationId));
  } catch {
    return null;
  }
};

const saveCachedSecret = (integrationId: string, secret: string) => {
  try {
    localStorage.setItem(secretCacheKey(integrationId), secret);
  } catch {
    // ignore
  }
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

// Trigger: From spreadsheet → On form submit
function onFormSubmit(e) {
  // Timestamp real (primera columna suele ser timestamp)
  const sheetTimestamp = (e && e.values && e.values[0]) ? e.values[0] : null;

  const payload = {
    secret: WEBHOOK_SECRET,

    // Preferimos timestamp del sheet si existe, si no usamos "ahora"
    submittedAt: sheetTimestamp
      ? new Date(sheetTimestamp).toISOString()
      : new Date().toISOString(),

    // Named values
    namedValues: (e && e.namedValues) ? e.namedValues : {},

    // Fila completa
    values: (e && e.values) ? e.values : [],

    // Meta útil para debug
    meta: {
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      sheetName: SpreadsheetApp.getActiveSheet().getName(),
      formUrl: SpreadsheetApp.getActiveSpreadsheet().getFormUrl(),
    },
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    Logger.log("Sending payload namedValues:");
    Logger.log(JSON.stringify(payload.namedValues, null, 2));

    const res = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("STATUS " + res.getResponseCode());
    Logger.log("BODY " + res.getContentText());
  } catch (err) {
    Logger.log("ERROR");
    Logger.log(String(err));
  }
}
`.trim();

async function copyToClipboard(text: string, label: string) {
  await navigator.clipboard.writeText(text);
  toast.success(`${label} copiado`);
}

const labelForType = (t: IntegrationType) => {
  if (t === "google_forms") return "Google Forms";
  if (t === "mercadolibre") return "Mercado Libre";
  if (t === "tiendanube") return "Tienda Nube";
  if (t === "woocommerce") return "WooCommerce";
  return t;
};

const Integrations = () => {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id ?? null;

  // -------------------- Google Forms modal --------------------
  const [configModal, setConfigModal] = useState<ConfigModalState>({ open: false });
  const [gfWebhookUrl, setGfWebhookUrl] = useState<string>("");
  const [gfSecret, setGfSecret] = useState<string>("");
  const [showInstructions, setShowInstructions] = useState<boolean>(true);

  // Carga secret guardado para Google Forms (DB) y fallback a cache local; NO lo regeneres salvo que no exista
  useEffect(() => {
    const run = async () => {
      if (!isGoogleFormsModal(configModal)) return;

      const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
      if (base) {
        setGfWebhookUrl(`${base}/functions/v1/webhooks-google-forms?integrationId=${configModal.integrationId}`);
      }

      // 1) cache local primero (UX instantáneo)
      const cached = loadCachedSecret(configModal.integrationId);
      if (cached) setGfSecret(cached);

      try {
        // 2) DB (source of truth)
        const { data, error } = await supabase.functions.invoke("integrations-get-credentials", {
          body: { integrationId: configModal.integrationId },
        });
        if (error) throw error;

        const saved = data?.webhookSecret ?? null;

        if (saved) {
          setGfSecret(saved);
          saveCachedSecret(configModal.integrationId, saved);
        } else {
          // 3) si NO hay guardado, generá UNA vez (y cachealo) pero no lo cambies solo
          setGfSecret((prev) => {
            const next = prev || cached || genSecret();
            saveCachedSecret(configModal.integrationId, next);
            return next;
          });
        }
      } catch (e) {
        // si falla DB, asegurar que quede algún secret estable
        setGfSecret((prev) => {
          const next = prev || cached || genSecret();
          saveCachedSecret(configModal.integrationId, next);
          return next;
        });
      }

      setShowInstructions(true);
    };

    run();
  }, [configModal.open, isGoogleFormsModal(configModal) ? configModal.integrationId : null]);

  const appsScript = useMemo(() => buildAppsScript(gfWebhookUrl, gfSecret), [gfWebhookUrl, gfSecret]);

  // -------------------- Order detail modal --------------------
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<IntegrationOrderRow | null>(null);

  const openOrder = (o: IntegrationOrderRow) => {
    setSelectedOrder(o);
    setOrderModalOpen(true);
  };

  const closeOrder = (open: boolean) => {
    setOrderModalOpen(open);
    if (!open) setSelectedOrder(null);
  };

  const formatMoney = (amount: any, currency?: string | null) => {
    const n = typeof amount === "string" ? Number(amount) : amount;
    if (n === null || n === undefined || Number.isNaN(n)) return "-";
    const cur = (currency ?? "ARS").toUpperCase();
    try {
      return new Intl.NumberFormat("es-AR", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${n} ${cur}`;
    }
  };

  const integrationTypes = useMemo(
    () => [
      {
        type: "mercadolibre" as const,
        name: "Mercado Libre",
        icon: ShoppingCart,
        description: "Conectá tu cuenta de Mercado Libre y sincronizá pedidos",
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

  // -------------------- Queries --------------------
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

  // ---- derivaciones integraciones activas
  const activeIntegrationTypes = useMemo(() => {
    return new Set(
      (integrations ?? [])
        .filter((i) => i.active)
        .map((i) => i.integration_type as IntegrationType)
    );
  }, [integrations]);

  const hasAnyActiveIntegration = useMemo(() => activeIntegrationTypes.size > 0, [activeIntegrationTypes]);

  // ---- filtros por tipo (chips)
  const [orderTypeFilter, setOrderTypeFilter] = useState<Record<IntegrationType, boolean>>({
    mercadolibre: true,
    tiendanube: true,
    woocommerce: true,
    google_forms: true,
  });

  // si un módulo deja de estar activo, apago su filtro automáticamente
  useEffect(() => {
    setOrderTypeFilter((prev) => {
      const next = { ...prev };
      (Object.keys(next) as IntegrationType[]).forEach((t) => {
        if (!activeIntegrationTypes.has(t)) next[t] = false;
      });
      return next;
    });
  }, [activeIntegrationTypes]);

  const selectedTypes = useMemo(() => {
    const selected = new Set<IntegrationType>();
    (Object.keys(orderTypeFilter) as IntegrationType[]).forEach((t) => {
      if (orderTypeFilter[t] && activeIntegrationTypes.has(t)) selected.add(t);
    });
    return selected;
  }, [orderTypeFilter, activeIntegrationTypes]);

  const hasSelectedTypes = useMemo(() => selectedTypes.size > 0, [selectedTypes]);

  // ---- Orders infinite query (pages de 15)
  const PAGE_SIZE = 15;

  const {
    data: ordersPages,
    isLoading: isLoadingOrders,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "integration_orders",
      companyId,
      [...activeIntegrationTypes].sort().join(","),
      (Object.keys(orderTypeFilter) as IntegrationType[])
        .filter((t) => orderTypeFilter[t])
        .sort()
        .join(","),
    ],
    enabled: !!companyId && hasAnyActiveIntegration && hasSelectedTypes,
    initialPageParam: 0 as number,
    queryFn: async ({ pageParam }) => {
      if (!companyId) return [];

      const from = pageParam as number;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("integration_orders")
        .select(
          `
          id,
          external_order_id,
          customer_name,
          customer_email,
          customer_phone,
          status,
          created_at,
          currency,
          total_amount,
          items_count,
          external_created_at,
          order_data,
          integrations (
            integration_type,
            name
          )
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return (data ?? []) as unknown as IntegrationOrderRow[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
  });

  const allOrders = useMemo(() => {
    const pages = ordersPages?.pages ?? [];
    return pages.flat();
  }, [ordersPages]);

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const t = (o.integrations?.integration_type ?? "") as IntegrationType;
      return selectedTypes.has(t);
    });
  }, [allOrders, selectedTypes]);

  // counts reales desde DB (para mostrar "0" aunque esté off)
  const { data: countsRows, isLoading: isLoadingCounts } = useQuery({
    queryKey: ["integration_orders_counts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("integration_orders_counts", {
        p_company_id: companyId,
      });
      if (error) throw error;
      return (data as unknown) as { integration_type: string; total: number }[];
    },
  });

  const countsByTypeDb = useMemo(() => {
    const base: Record<IntegrationType, number> = {
      mercadolibre: 0,
      tiendanube: 0,
      woocommerce: 0,
      google_forms: 0,
    };

    (countsRows ?? []).forEach((r) => {
      const t = r.integration_type as IntegrationType;
      if (t in base) base[t] = Number(r.total ?? 0);
    });

    return base;
  }, [countsRows]);

  // -------------------- Mutations --------------------
  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("integrations").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });
      queryClient.invalidateQueries({ queryKey: ["integration_orders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["integration_orders_counts", companyId] });
      toast.success("Integración actualizada");
    },
    onError: () => toast.error("Error al actualizar la integración"),
  });


  // -------------------- Helpers --------------------
  const getIntegrationStatus = (type: IntegrationType | string) => {
    return integrations?.find((i) => i.integration_type === type);
  };

  /**
   * Requires UNIQUE constraint: (company_id, integration_type)
   * alter table public.integrations add constraint integrations_company_type_unique unique (company_id, integration_type);
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

    queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });
    return data as IntegrationRow;
  };

  // ✅ MercadoLibre: arranca OAuth (Edge Function integrations-ml-start)
  const startMercadoLibreOAuth = async (integrationId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("integrations-ml-start", {
        body: { integrationId },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No URL de autorización (revisá integrations-ml-start)");
      window.location.href = data.url;
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "No se pudo iniciar OAuth de Mercado Libre");
    }
  };

  const onConfigure = async (type: IntegrationType) => {
    try {
      const row = await ensureIntegrationRow(type);

      if (type === "mercadolibre") {
        // 👇 ahora MercadoLibre se conecta con OAuth ML (no usamos integrations-start acá)
        await startMercadoLibreOAuth(row.id);
        return;
      }

      if (type === "tiendanube") {
        // dejalo como estaba si ya lo tenías armado con integrations-start
        const { data, error } = await supabase.functions.invoke("integrations-ml-start", {
          body: { integrationId: row.id, type },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("No URL de autorización (falta configurar OAuth)");
        window.location.href = data.url;
        return;
      }

      if (type === "woocommerce") {
        toast.info("WooCommerce: falta agregar modal de keys (storeUrl, consumerKey, consumerSecret).");
        return;
      }

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

  const saveGoogleFormsCredentials = async () => {
    if (!companyId) return toast.error("No hay companyId");
    if (!gfSecret || gfSecret.length < 16) return toast.error("El secret debe tener al menos 16 caracteres");
    if (!gfWebhookUrl) return toast.error("No se pudo armar el webhook URL (revisá VITE_SUPABASE_URL)");
    if (!configModal.open) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("No estás logueado (no hay sesión). Iniciá sesión y reintentá.");
        return;
      }

      const { error: fnErr } = await supabase.functions.invoke("integrations-save-credentials", {
        body: {
          integrationId: configModal.integrationId,
          type: "google_forms",
          credentials: { webhookSecret: gfSecret },
        },
      });
      if (fnErr) throw fnErr;

      const { error: upErr } = await supabase
        .from("integrations")
        .update({ config: { googleForms: { webhookUrl: gfWebhookUrl } } })
        .eq("id", configModal.integrationId);

      if (upErr) throw upErr;

      toast.success("Google Forms configurado (secret guardado)");

      if (isGoogleFormsModal(configModal)) {
        saveCachedSecret(configModal.integrationId, gfSecret);
      }

      queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });
      setConfigModal({ open: false });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "No se pudo guardar (falta deploy de Edge Function integrations-save-credentials)");
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

  // -------------------- Loading --------------------
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
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 md:h-8 md:w-8" />
          <h1 className="text-2xl md:text-3xl font-bold">Integraciones</h1>
        </div>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                      {status && (
                        <Badge variant={status.active ? "default" : "secondary"} className="mt-1">
                          {status.active ? "Activo" : "Inactivo"}
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
                <CardDescription className="mb-4">
                  {integration.description}
                </CardDescription>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => onConfigure(integration.type)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Configurar
                </Button>
              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>
    </Layout>
  );
}

export default Integrations;
