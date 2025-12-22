import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, Check, X, Package } from "lucide-react";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface TransferItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

interface Transfer {
  id: string;
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  notes: string;
  transfer_date: string;
  requested_by: string;
  from_warehouse: { name: string; code: string };
  to_warehouse: { name: string; code: string };
}

export default function WarehouseTransfers() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState<string>("");
  const [toWarehouse, setToWarehouse] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("company_id", currentCompany?.id)
        .eq("active", true);
      if (error) throw error;
      return data as Warehouse[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-for-transfer", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("company_id", currentCompany?.id)
        .eq("active", true);
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["warehouse-transfers", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_transfers")
        .select(`
          *,
          from_warehouse:warehouses!warehouse_transfers_from_warehouse_id_fkey(name, code),
          to_warehouse:warehouses!warehouse_transfers_to_warehouse_id_fkey(name, code)
        `)
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Transfer[];
    },
  });

  const createTransfer = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autorizado");

      const transferNumber = await generateTransferNumber();
      
      const { data: transfer, error: transferError } = await supabase
        .from("warehouse_transfers")
        .insert([{
          transfer_number: transferNumber,
          from_warehouse_id: fromWarehouse,
          to_warehouse_id: toWarehouse,
          status: "pending",
          requested_by: user.id,
          notes,
          company_id: currentCompany?.id,
        }])
        .select()
        .single();

      if (transferError) throw transferError;

      const { error: itemsError } = await supabase
        .from("warehouse_transfer_items")
        .insert(
          items.map((item) => ({
            transfer_id: transfer.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            company_id: currentCompany?.id!
          }))
        );

      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-transfers"] });
      toast.success("Transferencia creada exitosamente");
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateTransferStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autorizado");

      const updates: any = { status };
      if (status === "approved") {
        updates.approved_by = user.id;
      } else if (status === "received") {
        updates.received_by = user.id;
      }

      const { error } = await supabase
        .from("warehouse_transfers")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-transfers"] });
      toast.success("Estado actualizado");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const generateTransferNumber = async () => {
    const { data, error } = await supabase.rpc("generate_transfer_number");
    if (error) throw error;
    return data;
  };

  const resetForm = () => {
    setFromWarehouse("");
    setToWarehouse("");
    setNotes("");
    setItems([]);
    setSelectedProduct("");
    setQuantity(1);
  };

  const addItem = () => {
    if (!selectedProduct || quantity <= 0) {
      toast.error("Seleccione un producto y cantidad válida");
      return;
    }

    const product = products?.find((p) => p.id === selectedProduct);
    if (!product) return;

    const existingItem = items.find((i) => i.product_id === selectedProduct);
    if (existingItem) {
      setItems(
        items.map((i) =>
          i.product_id === selectedProduct
            ? { ...i, quantity: i.quantity + quantity }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          product_id: product.id,
          product_name: product.name,
          quantity,
        },
      ]);
    }

    setSelectedProduct("");
    setQuantity(1);
  };

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.product_id !== productId));
  };

  const handleSubmit = () => {
    if (!fromWarehouse || !toWarehouse) {
      toast.error("Seleccione depósito origen y destino");
      return;
    }

    if (fromWarehouse === toWarehouse) {
      toast.error("El depósito origen y destino no pueden ser el mismo");
      return;
    }

    if (items.length === 0) {
      toast.error("Agregue al menos un producto");
      return;
    }

    createTransfer.mutate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pendiente</Badge>;
      case "approved":
        return <Badge variant="default">Aprobada</Badge>;
      case "received":
        return <Badge className="bg-green-600">Recibida</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <ArrowLeftRight className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold">Transferencias entre Depósitos</h1>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="hover:scale-105 transition-transform">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Transferencia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl animate-scale-in">
              <DialogHeader>
                <DialogTitle>Nueva Transferencia</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Depósito Origen *</Label>
                    <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses?.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.code} - {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Depósito Destino *</Label>
                    <Select value={toWarehouse} onValueChange={setToWarehouse}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses?.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.code} - {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Notas</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observaciones sobre la transferencia..."
                    rows={3}
                  />
                </div>

                <div className="border-t pt-4">
                  <Label className="text-lg">Productos</Label>
                  <div className="flex gap-2 mt-2">
                    <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar producto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-24"
                      placeholder="Cant."
                    />
                    <Button onClick={addItem} type="button">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    {items.map((item) => (
                      <div key={item.product_id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          <span>{item.product_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">x{item.quantity}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.product_id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit}>
                    Crear Transferencia
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-2 sm:p-6">
          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Número</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="hidden md:table-cell">Solicitado por</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {transfers?.map((transfer, index) => (
                  <TableRow key={transfer.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <TableCell>
                      <code className="font-mono text-xs sm:text-sm">{transfer.transfer_number}</code>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {format(new Date(transfer.transfer_date), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{transfer.from_warehouse.code}</Badge>
                      <div className="text-xs text-muted-foreground mt-1 hidden sm:block">
                        {transfer.from_warehouse.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{transfer.to_warehouse.code}</Badge>
                      <div className="text-xs text-muted-foreground mt-1 hidden sm:block">
                        {transfer.to_warehouse.name}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">-</TableCell>
                    <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {transfer.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateTransferStatus.mutate({ id: transfer.id, status: "approved" })}
                              className="hover:scale-110 transition-transform"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateTransferStatus.mutate({ id: transfer.id, status: "cancelled" })}
                              className="hover:scale-110 transition-transform"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          </>
                        )}
                        {transfer.status === "approved" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateTransferStatus.mutate({ id: transfer.id, status: "received" })}
                            className="hover:scale-110 transition-transform"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Recibir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
