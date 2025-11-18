import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, RotateCcw, CheckCircle, XCircle, Eye, Info, User, ShoppingCart, Package, Building2, Wallet, CreditCard, ArrowLeftRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { useCompany } from "@/contexts/CompanyContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function Returns() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("credit_note");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [returnItems, setReturnItems] = useState<Array<{ product_id: string; product_name: string; unit_price: number; quantity: number; subtotal: number }>>([]);
  const queryClient = useQueryClient();

  const { currentCompany } = useCompany();

  // Sales for origin selection
  const { data: sales } = useQuery({
    queryKey: ["sales-for-returns", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select(`id, sale_number, customer_id, customer:customers(name), sale_items(*)`)
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  // Warehouses for stock destination
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, is_main")
        .eq("company_id", currentCompany?.id)
        .eq("active", true)
        .order("is_main", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const selectedSale = sales?.find((s) => s.id === selectedSaleId);

  const updateItemsFromSale = (sale: any) => {
    if (!sale) {
      setReturnItems([]);
      return;
    }
    const items = (sale.sale_items || []).map((it: any) => ({
      product_id: it.product_id,
      product_name: it.product_name,
      unit_price: Number(it.unit_price) || 0,
      quantity: 0,
      subtotal: 0,
    }));
    setReturnItems(items);
  };

  const updateItemQty = (idx: number, qty: number) => {
    setReturnItems((prev) => {
      const next = [...prev];
      const item = next[idx];
      const quantity = Math.max(0, qty);
      item.quantity = quantity;
      item.subtotal = quantity * item.unit_price;
      return next;
    });
  };

  const totals = returnItems.reduce(
    (acc, it) => {
      acc.subtotal += it.subtotal;
      return acc;
    },
    { subtotal: 0 }
  );
  const total = totals.subtotal;
  
  const { data: returns } = useQuery({
    queryKey: ["returns", searchQuery, currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from("returns")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`return_number.ilike.%${sanitized}%,customer_name.ilike.%${sanitized}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: returnDetails } = useQuery({
    queryKey: ["return-details", selectedReturn?.id],
    queryFn: async () => {
      if (!selectedReturn?.id) return null;

      const { data, error } = await supabase
        .from("returns")
        .select(`
          *,
          return_items(*)
        `)
        .eq("id", selectedReturn.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedReturn?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "approved" || status === "completed") {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("returns")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;

      // Si es aprobada y método es credit_note, crear nota de crédito
      if (status === "approved") {
        const returnData = returns?.find(r => r.id === id);
        if (returnData && returnData.refund_method === "credit_note") {
          const { data: numberData } = await supabase.rpc("generate_credit_note_number");
          
          await supabase.from("credit_notes").insert({
            credit_note_number: numberData,
            return_id: id,
            customer_id: returnData.customer_id,
            amount: returnData.total,
            balance: returnData.total,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Estado actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      queryClient.invalidateQueries({ queryKey: ["return-details"] });
    },
    onError: (error: Error) => {
      toast.error("Error: " + error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return (
        <Badge className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Completada
        </Badge>
      );
    }
    if (status === "approved") {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Aprobada
        </Badge>
      );
    }
    if (status === "pending") {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Rechazada
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Info className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const createReturnMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSale) throw new Error("Seleccione una venta");
      const itemsToInsert = returnItems.filter((i) => i.quantity > 0);
      if (itemsToInsert.length === 0) throw new Error("Seleccione al menos un producto");

      // Generate return number
      const { data: numberData } = await supabase.rpc("generate_return_number");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const totalAmount = itemsToInsert.reduce((s, it) => s + it.subtotal, 0);
      const customerName = selectedSale.customer?.name || "Cliente";

      const { data: ret, error: retErr } = await supabase
        .from("returns")
        .insert({
          return_number: numberData,
          sale_id: selectedSale.id,
          customer_id: selectedSale.customer_id,
          customer_name: customerName,
          reason,
          notes,
          refund_method: refundMethod,
          total: totalAmount,
          status: "pending",
          company_id: currentCompany?.id,
          user_id: user.id,
        })
        .select()
        .single();
      if (retErr) throw retErr;

      const items = itemsToInsert.map((it) => ({
        return_id: ret.id,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        subtotal: it.subtotal,
        company_id: currentCompany?.id,
      }));
      const { error: itemsErr } = await supabase.from("return_items").insert(items);
      if (itemsErr) throw itemsErr;

      return ret;
    },
    onSuccess: () => {
      toast.success("Devolución creada");
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      setIsCreateOpen(false);
      // reset form
      setSelectedSaleId("");
      setReason("");
      setNotes("");
      setRefundMethod("credit_note");
      setWarehouseId("");
      setReturnItems([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getRefundMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      cash: "Efectivo",
      card: "Tarjeta",
      credit_note: "Nota de Crédito",
      exchange: "Cambio",
    };
    return labels[method] || method;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Devoluciones</h1>
          <p className="text-muted-foreground">Gestión de devoluciones y reembolsos</p>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número o cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button className="gap-2">
                          <RotateCcw className="h-4 w-4" />
                          Nueva Devolución
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Registrar nueva devolución</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <RotateCcw className="h-5 w-5 text-primary" />
                      Nueva Devolución
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {/* Origen */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="text-sm font-semibold">Origen de la Devolución</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Venta *</Label>
                          <Select
                            value={selectedSaleId}
                            onValueChange={(v) => {
                              setSelectedSaleId(v);
                              const sale = (sales || []).find((s) => s.id === v);
                              updateItemsFromSale(sale);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una venta" />
                            </SelectTrigger>
                            <SelectContent>
                              {sales?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.sale_number} - {s.customer?.name || "Cliente"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Cliente</Label>
                          <Input value={selectedSale?.customer?.name || ""} disabled placeholder="Cliente" />
                        </div>
                      </div>
                    </div>

                    {/* Ítems devueltos */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <Package className="h-4 w-4 text-green-600 dark:text-green-500" />
                        </div>
                        <h3 className="text-sm font-semibold">Ítems devueltos</h3>
                      </div>
                      {returnItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Selecciona una venta para listar sus productos.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Producto</TableHead>
                              <TableHead className="text-center">Cantidad</TableHead>
                              <TableHead className="text-right">Precio Unit.</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {returnItems.map((it, idx) => (
                              <TableRow key={`${it.product_id}-${idx}`}>
                                <TableCell className="font-medium">{it.product_name}</TableCell>
                                <TableCell className="text-center">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={it.quantity}
                                    onChange={(e) => updateItemQty(idx, parseInt(e.target.value || "0", 10))}
                                    className="w-24 mx-auto text-center"
                                  />
                                </TableCell>
                                <TableCell className="text-right">${it.unit_price.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-medium">${it.subtotal.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Stock y Compensación */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                          <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                        </div>
                        <h3 className="text-sm font-semibold">Stock y Compensación</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Depósito de ingreso</Label>
                          <Select value={warehouseId} onValueChange={setWarehouseId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un depósito" />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses?.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                  {w.name} {w.is_main ? "(Principal)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Método de reembolso</Label>
                          <Select value={refundMethod} onValueChange={setRefundMethod}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="credit_note">Nota de Crédito</SelectItem>
                              <SelectItem value="cash">Efectivo</SelectItem>
                              <SelectItem value="card">Tarjeta</SelectItem>
                              <SelectItem value="exchange">Cambio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Motivo y notas */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                        </div>
                        <h3 className="text-sm font-semibold">Detalles</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Motivo</Label>
                          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la devolución" />
                        </div>
                        <div>
                          <Label>Notas</Label>
                          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas internas" />
                        </div>
                      </div>
                    </div>

                    {/* Resumen */}
                    <div className="bg-muted/30 border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Resumen</h3>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total devuelto:</span>
                        <span className="text-red-600 dark:text-red-400">${total.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                      <Button className="gap-2" disabled={!selectedSale || returnItems.every(i => i.quantity === 0)} onClick={() => createReturnMutation.mutate()}>
                        <CheckCircle2 className="h-4 w-4" />
                        Crear Devolución
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Método Reembolso</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns?.map((returnItem) => (
                  <TableRow key={returnItem.id}>
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        {returnItem.return_number}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(returnItem.created_at), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>{returnItem.customer_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {returnItem.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getRefundMethodLabel(returnItem.refund_method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-destructive">
                      ${Number(returnItem.total).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReturn(returnItem);
                                  setIsDetailOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalle</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {returnItem.status === "pending" && (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="text-success"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateStatusMutation.mutate({ id: returnItem.id, status: "approved" });
                                    }}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Aprobar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateStatusMutation.mutate({ id: returnItem.id, status: "rejected" });
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Rechazar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                Detalle de Devolución - {selectedReturn?.return_number}
              </DialogTitle>
            </DialogHeader>

            {returnDetails && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Información General
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cliente:</span>
                        <span className="font-medium">{returnDetails.customer_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha:</span>
                        <span className="font-medium">
                          {format(new Date(returnDetails.created_at), "dd/MM/yyyy HH:mm", {
                            locale: es,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estado:</span>
                        {getStatusBadge(returnDetails.status)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Reembolso
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Método:</span>
                        <Badge variant="outline">
                          {getRefundMethodLabel(returnDetails.refund_method)}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monto:</span>
                        <span className="text-lg font-bold text-destructive">
                          ${Number(returnDetails.total).toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Motivo de Devolución</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground">{returnDetails.reason}</p>
                    {returnDetails.notes && (
                      <>
                        <Separator className="my-3" />
                        <p className="text-xs text-muted-foreground">{returnDetails.notes}</p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Productos Devueltos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-center">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unit.</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnDetails.return_items?.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.product_name}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              ${Number(item.unit_price).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${Number(item.subtotal).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                    Cerrar
                  </Button>
                  {returnDetails.status === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          updateStatusMutation.mutate({
                            id: returnDetails.id,
                            status: "rejected",
                          });
                          setIsDetailOpen(false);
                        }}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Rechazar
                      </Button>
                      <Button
                        className="bg-success"
                        onClick={() => {
                          updateStatusMutation.mutate({
                            id: returnDetails.id,
                            status: "approved",
                          });
                          setIsDetailOpen(false);
                        }}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Aprobar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
