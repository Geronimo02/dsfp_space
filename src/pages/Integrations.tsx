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

const buildGoogleFormsWebhookUrl = () => {
  const base = getFunctionsBaseUrl();
  return base ? `${base}/webhooks-google-forms` : "";
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

  useEffect(() => {
  const run = async () => {
    if (!isGoogleFormsModal(configModal)) return;

    const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    if (base) {
      setGfWebhookUrl(`${base}/functions/v1/webhooks-google-forms?integrationId=${configModal.integrationId}`);
    }

    try {
      const { data, error } = await supabase.functions.invoke("integrations-get-credentials", {
        body: { integrationId: configModal.integrationId },
      });

      if (error) throw error;

      const saved = data?.webhookSecret ?? null;

      if (saved) {
        setGfSecret(saved);
      } else {
        // si no hay guardado, generás uno pero NO lo cambiás luego solo
        setGfSecret((prev) => prev || genSecret());
      }
    } catch (e) {
      // fallback solo si no tenías nada ya seteado
      setGfSecret((prev) => prev || genSecret());
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
    enabled: !!companyId && hasAnyActiveIntegration && hasSelectedTypes, // ✅ bloquea query si no hay activas o no hay filtros
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
      // ✅ evita el error de TS cuando los tipos no están regenerados
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
  const getIntegrationStatus = (type: IntegrationType) => {
    return (integrations ?? []).find((i) => i.integration_type === type) ?? null;
  };

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

  const onConfigure = async (type: IntegrationType) => {
    try {
      const row = await ensureIntegrationRow(type);

      if (type === "mercadolibre" || type === "tiendanube") {
        const { data, error } = await supabase.functions.invoke("integrations-start", {
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
      // ✅ cache local para que NO cambie al refrescar
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
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: status.id, active: checked })}
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

        {/* ---------------- Pedidos Sincronizados ---------------- */}
        {hasAnyActiveIntegration && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Pedidos Sincronizados</CardTitle>
              <CardDescription>Últimos pedidos recibidos desde las integraciones</CardDescription>
            </CardHeader>

            <CardContent>
              {/* Filtros chips */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(Object.keys(orderTypeFilter) as IntegrationType[])
                  .filter((t) => activeIntegrationTypes.has(t))
                  .map((t) => {
                    const on = orderTypeFilter[t];
                    const countLabel = isLoadingCounts ? "—" : String(countsByTypeDb[t] ?? 0);

                    return (
                      <Badge
                        key={t}
                        variant={on ? "default" : "outline"}
                        className="cursor-pointer select-none px-3 py-1.5 text-sm"
                        onClick={() => setOrderTypeFilter((p) => ({ ...p, [t]: !p[t] }))}
                        title="Click para filtrar"
                      >
                        {labelForType(t)} <span className="ml-2 opacity-80">({countLabel})</span>
                      </Badge>
                    );
                  })}

                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOrderTypeFilter((p) => {
                        const next = { ...p };
                        (Object.keys(next) as IntegrationType[]).forEach((t) => {
                          next[t] = activeIntegrationTypes.has(t);
                        });
                        return next;
                      })
                    }
                  >
                    Ver todos
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setOrderTypeFilter((p) => {
                        const next = { ...p };
                        (Object.keys(next) as IntegrationType[]).forEach((t) => (next[t] = false));
                        return next;
                      })
                    }
                  >
                    Limpiar
                  </Button>
                </div>
              </div>

              {!hasSelectedTypes ? (
                <div className="text-center text-muted-foreground py-8">
                  Seleccioná al menos una integración para ver pedidos.
                </div>
              ) : isLoadingOrders ? (
                <div className="text-center text-muted-foreground py-8">Cargando pedidos...</div>
              ) : filteredOrders.length > 0 ? (
                <div className="space-y-3">
                  {filteredOrders.map((o) => (
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

                        <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                          <span>{o.created_at ? new Date(o.created_at).toLocaleString() : ""}</span>
                          {o.items_count != null && <span>{o.items_count} ítems</span>}
                          {o.total_amount != null && <span>{formatMoney(o.total_amount, o.currency)}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant={o.status === "processed" ? "default" : "secondary"}>{o.status || "unknown"}</Badge>
                        <Button variant="outline" size="sm" onClick={() => openOrder(o)}>
                          Ver pedido
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-4 flex justify-center">
                    {hasNextPage ? (
                      <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                        {isFetchingNextPage ? "Cargando..." : "Cargar más"}
                      </Button>
                    ) : (
                      <div className="text-xs text-muted-foreground py-2">No hay más pedidos</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No hay pedidos para los filtros seleccionados
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ---------------- Modal: Ver pedido ---------------- */}
      <Dialog open={orderModalOpen} onOpenChange={closeOrder}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del pedido</DialogTitle>
            <DialogDescription>
              {(selectedOrder?.integrations?.name || selectedOrder?.integrations?.integration_type || "Integración") +
                " · #" +
                (selectedOrder?.external_order_id ?? "s/n")}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div>
                      <b>Nombre:</b> {selectedOrder?.customer_name ?? "-"}
                    </div>
                    <div>
                      <b>Email:</b> {selectedOrder?.customer_email ?? "-"}
                    </div>
                    <div>
                      <b>WhatsApp:</b> {selectedOrder?.customer_phone ?? "-"}
                    </div>
                    <div>
                      <b>Fecha:</b>{" "}
                      {selectedOrder?.created_at ? new Date(selectedOrder.created_at).toLocaleString() : "-"}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resumen</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div>
                      <b>Estado:</b> {selectedOrder?.status ?? "-"}
                    </div>
                    <div>
                      <b>Ítems:</b> {selectedOrder?.items_count ?? selectedOrder?.order_data?.totals?.items_count ?? "-"}
                    </div>
                    <div>
                      <b>Total:</b>{" "}
                      {formatMoney(
                        selectedOrder?.total_amount ?? selectedOrder?.order_data?.totals?.total_amount,
                        selectedOrder?.currency ?? selectedOrder?.order_data?.currency
                      )}
                    </div>
                    <div>
                      <b>Moneda:</b> {(selectedOrder?.currency ?? selectedOrder?.order_data?.currency ?? "-").toString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div>
                <div className="text-base font-semibold mb-2">Ítems</div>

                {Array.isArray(selectedOrder?.order_data?.items) && selectedOrder!.order_data.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrder!.order_data.items.map((it: any, idx: number) => (
                      <div key={idx} className="rounded-lg border p-3 text-sm">
                        <div className="font-medium">{it.product ?? `Item ${idx + 1}`}</div>
                        <div className="text-muted-foreground mt-1 flex flex-wrap gap-3">
                          <span>
                            Cant: <b>{it.qty ?? 1}</b>
                          </span>
                          <span>
                            Unit:{" "}
                            <b>
                              {formatMoney(
                                it.unit_price,
                                selectedOrder?.currency ?? selectedOrder?.order_data?.currency
                              )}
                            </b>
                          </span>
                          <span>
                            Subtotal:{" "}
                            <b>
                              {formatMoney(
                                it.line_total,
                                selectedOrder?.currency ?? selectedOrder?.order_data?.currency
                              )}
                            </b>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No hay items en este pedido.</div>
                )}
              </div>

              <Separator />

              <div className="grid gap-2 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notas</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedOrder?.order_data?.notes ?? "-"}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Condiciones</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div>
                      <b>Pago:</b> {selectedOrder?.order_data?.payment_terms ?? "-"}
                    </div>
                    <div>
                      <b>Vencimiento:</b> {selectedOrder?.order_data?.due_date ?? "-"}
                    </div>
                    <div>
                      <b>Extra:</b>{" "}
                      {formatMoney(
                        selectedOrder?.order_data?.extra_cost,
                        selectedOrder?.currency ?? selectedOrder?.order_data?.currency
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ---------------- Google Forms Modal ---------------- */}
      {configModal.open && configModal.type === "google_forms" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-background shadow-lg border max-h-[85vh] overflow-y-auto">
            <div className="p-5 flex items-start justify-between gap-4 border-b">
              <div>
                <div className="text-xl font-semibold">Conectar Google Forms</div>
                <div className="text-sm text-muted-foreground mt-1">Copiá y pegá. Esto conecta tu Form con RetailSnap sin OAuth.</div>
              </div>
              <Button variant="outline" onClick={() => setConfigModal({ open: false })}>
                Cerrar
              </Button>
            </div>

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
                    <input className="w-full rounded-md border bg-muted px-3 py-2 text-sm" value={gfWebhookUrl} readOnly />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => copyToClipboard(gfWebhookUrl, "Webhook URL")}
                      disabled={!gfWebhookUrl}
                    >
                      Copiar Webhook URL
                    </Button>
                    <div className="text-xs text-muted-foreground">Esta URL es única para tu empresa/integración.</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">2) Secret</CardTitle>
                    <CardDescription>Se genera automáticamente. Sirve para que nadie mande data falsa.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <input className="w-full rounded-md border bg-muted px-3 py-2 text-sm" value={gfSecret} readOnly />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => copyToClipboard(gfSecret, "Secret")}
                        disabled={!gfSecret}
                      >
                        Copiar Secret
                      </Button>
                      <Button variant="outline"
  onClick={() => {
    if (!isGoogleFormsModal(configModal)) return;
    const s = genSecret();
    setGfSecret(s);
    saveCachedSecret(configModal.integrationId, s);
  }}>
                        Regenerar
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">Si regenerás el secret, el script viejo deja de funcionar.</div>
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
