import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Zap, TrendingUp, Package, AlertCircle, CheckCircle, XCircle, Upload, Mail, MessageSquare, Users, Filter, FileUp, FileDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { useCompany } from "@/contexts/CompanyContext";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Dialog as ShadDialog, DialogContent as ShadDialogContent, DialogHeader as ShadDialogHeader, DialogTitle as ShadDialogTitle, DialogTrigger as ShadDialogTrigger } from "@/components/ui/dialog";
import { isValidEmail } from "@/lib/utils";

const EMAIL_MASSIVE_CONFIRM_THRESHOLD = 200;

export default function BulkOperations() {
  const { currentCompany } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("products");
  const [operationType, setOperationType] = useState<string>("update_prices");
  const [entityType, setEntityType] = useState<string>("products");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"percentage" | "fixed">("percentage");
  
  // Email/Message states
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const queryClient = useQueryClient();
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const canView = hasPermission("bulk_operations", "view");
  const canCreate = hasPermission("bulk_operations", "create");

  // Fetch bulk operations history
  const { data: operations, isLoading } = useQuery({
    queryKey: ["bulk-operations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulk_operations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: canView,
  });

  // Fetch customers for email/message operations
  const { data: customers } = useQuery({
    queryKey: ["customers-bulk", currentCompany?.id],
    queryFn: async () => {
      let query = supabase.from("customers").select("id, name, email, phone").eq("company_id", currentCompany?.id);
      
      if (filterType === "with_email") {
        query = query.not("email", "is", null);
      } else if (filterType === "with_phone") {
        query = query.not("phone", "is", null);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: (activeTab === "emails" || activeTab === "messages") && !!currentCompany?.id,
  });

  const executeBulkMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      let affectedRecords = 0;

      // Execute bulk operation based on type
      if (operationType === "update_prices" && entityType === "products") {
        const { data: products, error: fetchError } = await supabase
          .from("products")
          .select("id, price")
          .eq("company_id", currentCompany?.id)
          .eq("active", true);

        if (fetchError) throw fetchError;

        const updates = products?.map(product => {
          const newPrice = adjustmentType === "percentage"
            ? Number(product.price) * (1 + parseFloat(adjustmentValue) / 100)
            : Number(product.price) + parseFloat(adjustmentValue);

          return supabase
            .from("products")
            .update({ price: newPrice })
            .eq("id", product.id);
        });

        if (updates) {
          await Promise.all(updates);
          affectedRecords = products?.length || 0;
        }
      } else if (operationType === "activate_products") {
        const { count, error } = await supabase
          .from("products")
          .update({ active: true })
          .eq("company_id", currentCompany?.id)
          .eq("active", false);

        if (error) throw error;
        affectedRecords = count || 0;
      } else if (operationType === "deactivate_products") {
        const { count, error } = await supabase
          .from("products")
          .update({ active: false })
          .eq("company_id", currentCompany?.id)
          .eq("active", true)
          .lte("stock", 0);

        if (error) throw error;
        affectedRecords = count || 0;
      }

      // Log the operation
      const { error: logError } = await supabase.from("bulk_operations").insert({
        operation_type: operationType,
        entity_type: entityType,
        records_affected: affectedRecords,
        operation_data: {
          adjustmentType,
          adjustmentValue,
        },
        status: "completed",
        user_id: user.id,
        completed_at: new Date().toISOString(),
      });

      if (logError) throw logError;

      return affectedRecords;
    },
    onSuccess: (affectedRecords) => {
      queryClient.invalidateQueries({ queryKey: ["bulk-operations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Operación completada. ${affectedRecords} registros afectados`);
      setDialogOpen(false);
      setAdjustmentValue("");
    },
    onError: (error) => {
      toast.error("Error al ejecutar operación: " + error.message);
    },
  });

  const sendBulkEmailMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");
      // Insert log with status 'processing'
      const { data: logData, error: logError } = await supabase.from("bulk_operations").insert({
        operation_type: "send_email",
        entity_type: "customers",
        records_affected: recipientsCount,
        status: "processing",
        operation_data: { subject: emailSubject, selectionMode, filterType, scheduleAt: scheduleEnabled ? scheduleAt : null },
        user_id: user.id,
        created_at: new Date().toISOString(),
      }).select();
      if (logError) throw logError;
      const logId = logData?.[0]?.id;
      // Call edge function
      const { error, data } = await supabase.functions.invoke("send-bulk-email", {
        body: {
          recipients: recipients.map(c => ({ email: c.email, name: c.name, id: c.id })),
          subject: emailSubject,
          body: emailBody,
          scheduleAt: scheduleEnabled ? scheduleAt : null,
        },
      });
      // Update log
      if (!error) {
        await supabase.from("bulk_operations").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", logId);
      } else {
        await supabase.from("bulk_operations").update({ status: "failed", operation_data: { error: error.message } }).eq("id", logId);
        throw error;
      }
      return recipientsCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["bulk-operations"] });
      toast.success(`${count} emails enviados correctamente`);
      setDialogOpen(false);
      setEmailSubject("");
      setEmailBody("");
      setSelectedCustomerIds([]);
      setSelectionMode("allFiltered");
    },
    onError: (error) => {
      toast.error("Error al enviar emails: " + error.message);
    },
  });

  const sendBulkMessageMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const recipients = selectedMessageCustomerIds.length > 0 
        ? customers?.filter(c => selectedMessageCustomerIds.includes(c.id))
        : customers;

      // Log operation
      await supabase.from("bulk_operations").insert({
        operation_type: "send_message",
        entity_type: "customers",
        records_affected: recipients?.length || 0,
        operation_data: { message: messageBody },
        status: "completed",
        user_id: user.id,
        completed_at: new Date().toISOString(),
      });

      return recipients?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["bulk-operations"] });
      toast.success(`${count} mensajes enviados correctamente`);
      setDialogOpen(false);
      setMessageBody("");
      setSelectedMessageCustomerIds([]);
    },
    onError: (error) => {
      toast.error("Error al enviar mensajes: " + error.message);
    },
  });

  const sendTestEmailMutation = useMutation({
    mutationFn: async () => {
      if (!isValidEmail(testEmail)) throw new Error("Email destino inválido");
      const previewCustomer = filteredCustomers.find(c => c.id === previewCustomerId) || filteredCustomers[0];
      const previewName = previewCustomer?.name || "Cliente";
      const previewBody = emailBody.replace(/{{name}}/g, previewName);
      const { error } = await supabase.functions.invoke("send-test-email", {
        body: {
          toEmail: testEmail,
          subject: emailSubject,
          body: previewBody,
          previewData: { name: previewName },
        },
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Email de prueba enviado");
      setTestEmail("");
      setPreviewDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Error al enviar test: " + error.message);
    },
  });

  const handleExecute = () => {
    if (activeTab === "emails") {
      if (!emailSubject || !emailBody || recipientsCount === 0) {
        toast.error("Por favor completa el asunto y cuerpo del email");
        return;
      }
      sendBulkEmailMutation.mutate();
    } else if (activeTab === "messages") {
      if (!messageBody) {
        toast.error("Por favor ingresa el mensaje a enviar");
        return;
      }
      sendBulkMessageMutation.mutate();
    } else {
      if (operationType === "update_prices" && !adjustmentValue) {
        toast.error("Por favor ingresa un valor de ajuste");
        return;
      }
      executeBulkMutation.mutate();
    }
  };

  const [selectionMode, setSelectionMode] = useState<'allFiltered' | 'manual'>('allFiltered');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'preview' | 'test'>('preview');
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  const [selectedMessageCustomerIds, setSelectedMessageCustomerIds] = useState<string[]>([]);
  const handleSelectMessageCustomer = (id: string) => {
    setSelectedMessageCustomerIds(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
  };
  const handleSelectAllMessageCustomers = () => {
    setSelectedMessageCustomerIds(filteredCustomers.map(c => c.id));
  };
  const handleDeselectAllMessageCustomers = () => {
    setSelectedMessageCustomerIds([]);
  };

  const filteredCustomers = useMemo(() => {
    let list = customers || [];
    if (filterType === "with_email") list = list.filter(c => !!c.email);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(term) || (c.email || "").toLowerCase().includes(term));
    }
    return list;
  }, [customers, filterType, searchTerm]);

  const filteredCount = filteredCustomers.length;
  const selectedCount = selectionMode === "allFiltered" ? filteredCount : selectedCustomerIds.length;
  const recipients = selectionMode === "allFiltered"
    ? filteredCustomers.filter(c => !!c.email)
    : filteredCustomers.filter(c => selectedCustomerIds.includes(c.id) && !!c.email);
  const recipientsCount = recipients.length;
  const hasMissingEmails = selectionMode === "allFiltered" ? filteredCustomers.some(c => !c.email) : filteredCustomers.filter(c => selectedCustomerIds.includes(c.id)).some(c => !c.email);

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerIds(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
  };
  const handleSelectAll = () => {
    setSelectedCustomerIds(filteredCustomers.map(c => c.id));
  };
  const handleDeselectAll = () => {
    setSelectedCustomerIds([]);
  };

  if (permissionsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Cargando permisos...</p>
        </div>
      </Layout>
    );
  }

  if (!canView) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <AlertCircle className="h-16 w-16 text-warning" />
          <h2 className="text-2xl font-bold">Sin permisos</h2>
          <p className="text-muted-foreground">No tienes permisos para ver esta sección</p>
        </div>
      </Layout>
    );
  }

  const completedOps = operations?.filter(op => op.status === "completed").length || 0;
  const totalRecords = operations?.reduce((sum, op) => sum + op.records_affected, 0) || 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Operaciones Masivas</h1>
            <p className="text-muted-foreground">Ejecuta cambios en múltiples registros y envía comunicaciones masivas</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Operaciones Completadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedOps}</div>
              <p className="text-xs text-muted-foreground">Ejecutadas exitosamente</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registros Afectados</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRecords}</div>
              <p className="text-xs text-muted-foreground">Total procesados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Última Operación</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {operations && operations.length > 0 
                  ? format(new Date(operations[0].created_at), "dd/MM", { locale: es })
                  : "-"}
              </div>
              <p className="text-xs text-muted-foreground">Fecha</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails Masivos
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Mensajes
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Operaciones sobre Productos</CardTitle>
                <CardDescription>Actualiza precios, stock y estados de productos de forma masiva</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Tipo de Operación</Label>
                    <Select value={operationType} onValueChange={setOperationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="update_prices">Actualizar Precios</SelectItem>
                        <SelectItem value="update_stock">Actualizar Stock</SelectItem>
                        <SelectItem value="activate_products">Activar Productos</SelectItem>
                        <SelectItem value="deactivate_products">Desactivar Productos sin Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {operationType === "update_prices" && (
                    <>
                      <div>
                        <Label>Tipo de Ajuste</Label>
                        <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as "percentage" | "fixed")}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                            <SelectItem value="fixed">Valor Fijo ($)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Valor de Ajuste</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={adjustmentValue}
                          onChange={(e) => setAdjustmentValue(e.target.value)}
                          placeholder={adjustmentType === "percentage" ? "Ej: 10 para +10%" : "Ej: 5 para +$5"}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Vista Previa</p>
                      <p className="text-muted-foreground">
                        {operationType === "update_prices" && adjustmentValue
                          ? `Los precios se ${parseFloat(adjustmentValue) > 0 ? "aumentarán" : "reducirán"} en ${Math.abs(parseFloat(adjustmentValue))}${adjustmentType === "percentage" ? "%" : "$"}`
                          : operationType === "activate_products"
                          ? "Se activarán todos los productos desactivados"
                          : operationType === "deactivate_products"
                          ? "Se desactivarán todos los productos sin stock"
                          : "Selecciona una operación y configura los parámetros"}
                      </p>
                    </div>
                  </div>
                </div>

                {canCreate && (
                  <Button onClick={handleExecute} disabled={executeBulkMutation.isPending} className="w-full">
                    <Zap className="mr-2 h-4 w-4" />
                    {executeBulkMutation.isPending ? "Ejecutando..." : "Ejecutar Operación"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="emails" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Envío Masivo de Emails</CardTitle>
                <CardDescription>Envía emails personalizados a múltiples clientes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Filtrar Destinatarios</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los clientes</SelectItem>
                        <SelectItem value="with_email">Solo con email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Búsqueda</Label>
                    <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por nombre o email" />
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <RadioGroup value={selectionMode} onValueChange={v => setSelectionMode(v as 'allFiltered' | 'manual')} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="allFiltered" id="allFiltered" />
                      <label htmlFor="allFiltered" className="text-sm cursor-pointer">Enviar a todos los filtrados</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <label htmlFor="manual" className="text-sm cursor-pointer">Seleccionar manualmente</label>
                    </div>
                  </RadioGroup>
                  <div className="text-xs text-muted-foreground">Filtrados: {filteredCount} | Seleccionados: {selectedCount}</div>
                </div>
                <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                  {filteredCount === 0 ? (
                    <div className="text-center text-muted-foreground">0 resultados</div>
                  ) : selectionMode === "manual" ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Button variant="outline" size="sm" onClick={handleSelectAll}>Seleccionar todos</Button>
                        <Button variant="outline" size="sm" onClick={handleDeselectAll}>Deseleccionar todos</Button>
                      </div>
                      {filteredCustomers.map((customer) => (
                        <div key={customer.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={customer.id}
                            checked={selectedCustomerIds.includes(customer.id)}
                            onCheckedChange={() => handleSelectCustomer(customer.id)}
                          />
                          <label htmlFor={customer.id} className="text-sm flex-1 cursor-pointer">
                            {customer.name} {customer.email && `(${customer.email})`}
                          </label>
                          {!customer.email && <span className="text-xs text-warning">Sin email</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {filteredCustomers.map((customer) => (
                        <div key={customer.id} className="flex items-center space-x-2">
                          <Checkbox id={customer.id} checked disabled />
                          <label htmlFor={customer.id} className="text-sm flex-1 cursor-pointer">
                            {customer.name} {customer.email && `(${customer.email})`}
                          </label>
                          {!customer.email && <span className="text-xs text-warning">Sin email</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {hasMissingEmails && <div className="text-xs text-warning">Algunos clientes no tienen email y serán ignorados.</div>}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Asunto del Email</Label>
                    <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Ej: Ofertas especiales para ti" />
                  </div>
                  <div>
                    <Label>Cuerpo del Email</Label>
                    <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Escribe el contenido de tu email aquí..." rows={8} />
                  </div>
                </div>
                <div className="flex gap-4 items-center">
                  <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                  <span className="text-sm">{scheduleEnabled ? "Programar envío" : "Enviar ahora"}</span>
                  {scheduleEnabled && (
                    <Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} className="max-w-xs" />
                  )}
                  {scheduleEnabled && <span className="text-xs text-muted-foreground">Zona horaria: America/Argentina/Buenos_Aires</span>}
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" onClick={() => setPreviewDialogOpen(true)}>
                    Previsualizar y testear
                  </Button>
                  {canCreate && (
                    <Button
                      onClick={() => {
                        if (!emailSubject || !emailBody || recipientsCount === 0) {
                          toast.error("Completa asunto, cuerpo y destinatarios");
                          return;
                        }
                        if (recipientsCount >= EMAIL_MASSIVE_CONFIRM_THRESHOLD) {
                          setConfirmDialogOpen(true);
                        } else {
                          sendBulkEmailMutation.mutate();
                        }
                      }}
                      disabled={sendBulkEmailMutation.isPending || recipientsCount === 0 || !emailSubject || !emailBody}
                      className="w-full"
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      {sendBulkEmailMutation.isPending ? "Enviando..." : `Enviar Emails (${recipientsCount})`}
                    </Button>
                  )}
                </div>
                {/* Preview & Test Dialog */}
                <ShadDialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                  <ShadDialogContent>
                    <ShadDialogHeader>
                      <ShadDialogTitle>Previsualizar y Testear Email</ShadDialogTitle>
                    </ShadDialogHeader>
                    <Tabs value={previewTab} onValueChange={v => setPreviewTab(v as 'preview' | 'test')} className="mt-2">
                      <TabsList className="grid grid-cols-2 mb-4">
                        <TabsTrigger value="preview">Previsualizar</TabsTrigger>
                        <TabsTrigger value="test">Test</TabsTrigger>
                      </TabsList>
                      <TabsContent value="preview">
                        <div className="mb-2">
                          <Label>Previsualizar como</Label>
                          <Select value={previewCustomerId || filteredCustomers[0]?.id || ""} onValueChange={setPreviewCustomerId}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {filteredCustomers.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name} {c.email && `(${c.email})`}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="border rounded-lg p-4 bg-muted">
                          <div className="font-bold mb-2">{emailSubject}</div>
                          <div>{emailBody.replace(/{{name}}/g, (filteredCustomers.find(c => c.id === previewCustomerId)?.name || filteredCustomers[0]?.name || "Cliente"))}</div>
                        </div>
                      </TabsContent>
                      <TabsContent value="test">
                        <div className="mb-2">
                          <Label>Email destino</Label>
                          <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="tu@email.com" />
                        </div>
                        <Button
                          onClick={() => {
                            if (!emailSubject || !emailBody || !isValidEmail(testEmail)) {
                              toast.error("Completa asunto, cuerpo y email válido");
                              return;
                            }
                            sendTestEmailMutation.mutate();
                          }}
                          disabled={!emailSubject || !emailBody || !isValidEmail(testEmail) || sendTestEmailMutation.isPending}
                        >
                          {sendTestEmailMutation.isPending ? "Enviando..." : "Enviar test"}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </ShadDialogContent>
                </ShadDialog>
                {/* Confirmación masiva */}
                <ShadDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                  <ShadDialogContent>
                    <ShadDialogHeader>
                      <ShadDialogTitle>Confirmar envío masivo</ShadDialogTitle>
                      <DialogDescription>
                        Vas a enviar a {recipientsCount} destinatarios. Escribe <b>ENVIAR</b> para confirmar.
                      </DialogDescription>
                    </ShadDialogHeader>
                    <Input value={confirmInput} onChange={e => setConfirmInput(e.target.value)} placeholder="ENVIAR" />
                    <Button
                      disabled={confirmInput !== "ENVIAR"}
                      onClick={() => {
                        setConfirmDialogOpen(false);
                        sendBulkEmailMutation.mutate();
                      }}
                    >Confirmar y enviar</Button>
                  </ShadDialogContent>
                </ShadDialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Envío Masivo de Mensajes</CardTitle>
                <CardDescription>Envía notificaciones o mensajes a múltiples clientes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Filtrar Destinatarios</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      <SelectItem value="with_phone">Solo con teléfono</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mensaje</Label>
                  <Textarea
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    placeholder="Escribe tu mensaje aquí..."
                    rows={6}
                  />
                </div>

                <div className="border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Destinatarios ({selectedMessageCustomerIds.length > 0 ? selectedMessageCustomerIds.length : customers?.length || 0})</Label>
                    <Button variant="outline" size="sm" onClick={handleSelectAllMessageCustomers}>
                      {selectedMessageCustomerIds.length === customers?.length ? "Deseleccionar todos" : "Seleccionar todos"}
                    </Button>
                  </div>
                  {customers?.map((customer) => (
                    <div key={customer.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`msg-${customer.id}`}
                        checked={selectedMessageCustomerIds.includes(customer.id)}
                        onCheckedChange={() => handleSelectMessageCustomer(customer.id)}
                      />
                      <label htmlFor={`msg-${customer.id}`} className="text-sm flex-1 cursor-pointer">
                        {customer.name} {customer.phone && `(${customer.phone})`}
                      </label>
                    </div>
                  ))}
                </div>

                {canCreate && (
                  <Button onClick={handleExecute} disabled={sendBulkMessageMutation.isPending} className="w-full">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {sendBulkMessageMutation.isPending ? "Enviando..." : `Enviar Mensajes (${selectedMessageCustomerIds.length > 0 ? selectedMessageCustomerIds.length : customers?.length || 0})`}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Operaciones</CardTitle>
                <CardDescription>Registro de todas las operaciones masivas ejecutadas</CardDescription>
              </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Cargando historial...</p>
            ) : operations && operations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell>{format(new Date(op.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                      <TableCell className="capitalize">
                        {op.operation_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="capitalize">{op.entity_type}</TableCell>
                      <TableCell className="font-bold">{op.records_affected}</TableCell>
                      <TableCell>
                        <Badge variant={
                          op.status === "completed" ? "default" :
                          op.status === "failed" ? "destructive" : "secondary"
                        }>
                          <span className="flex items-center gap-1">
                            {op.status === "completed" ? <CheckCircle className="h-3 w-3" /> :
                             op.status === "failed" ? <XCircle className="h-3 w-3" /> : null}
                            {op.status === "completed" ? "Completado" :
                             op.status === "failed" ? "Fallido" : "Procesando"}
                          </span>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No hay operaciones registradas</p>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}