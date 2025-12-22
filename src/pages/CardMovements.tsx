import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, CreditCard, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";

export default function CardMovements() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    card_type: "credit",
    card_brand: "visa",
    sale_date: format(new Date(), "yyyy-MM-dd"),
    accreditation_date: format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    gross_amount: "",
    commission_percentage: "3",
    installments: "1",
    batch_number: "",
  });

  const { data: movements, isLoading } = useQuery({
    queryKey: ["card-movements", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_movements")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("sale_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const createMovement = useMutation({
    mutationFn: async (data: any) => {
      const grossAmount = parseFloat(data.gross_amount);
      const commissionPercentage = parseFloat(data.commission_percentage);
      const commissionAmount = (grossAmount * commissionPercentage) / 100;
      const netAmount = grossAmount - commissionAmount;

      const { error } = await supabase
        .from("card_movements")
        .insert({
          ...data,
          company_id: currentCompany?.id,
          gross_amount: grossAmount,
          commission_percentage: commissionPercentage,
          commission_amount: commissionAmount,
          net_amount: netAmount,
          installments: parseInt(data.installments),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-movements"] });
      toast.success("Movimiento de tarjeta registrado");
      setIsDialogOpen(false);
      setFormData({
        card_type: "credit",
        card_brand: "visa",
        sale_date: format(new Date(), "yyyy-MM-dd"),
        accreditation_date: format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        gross_amount: "",
        commission_percentage: "3",
        installments: "1",
        batch_number: "",
      });
    },
    onError: (error) => {
      toast.error("Error al registrar movimiento");
      console.error(error);
    },
  });

  const markAsAccredited = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("card_movements")
        .update({
          status: "accredited",
          accredited_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-movements"] });
      toast.success("Movimiento marcado como acreditado");
    },
  });

  const pendingMovements = movements?.filter((m: any) => m.status === "pending") || [];
  const accreditedMovements = movements?.filter((m: any) => m.status === "accredited") || [];
  const totalPending = pendingMovements.reduce((sum: number, m: any) => sum + m.net_amount, 0);
  const totalCommissions = movements?.reduce((sum: number, m: any) => sum + m.commission_amount, 0) || 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Movimientos de Tarjetas</h1>
            <p className="text-muted-foreground">
              Seguimiento de acreditaciones y comisiones
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Movimiento
              </Button>
            </DialogTrigger>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Movimiento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo Movimiento de Tarjeta</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Tipo de Tarjeta</label>
                    <Select
                      value={formData.card_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, card_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Crédito</SelectItem>
                        <SelectItem value="debit">Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Marca</label>
                    <Select
                      value={formData.card_brand}
                      onValueChange={(value) =>
                        setFormData({ ...formData, card_brand: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visa">Visa</SelectItem>
                        <SelectItem value="mastercard">Mastercard</SelectItem>
                        <SelectItem value="amex">American Express</SelectItem>
                        <SelectItem value="cabal">Cabal</SelectItem>
                        <SelectItem value="naranja">Naranja</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Fecha de Venta</label>
                    <Input
                      type="date"
                      value={formData.sale_date}
                      onChange={(e) =>
                        setFormData({ ...formData, sale_date: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Fecha de Acreditación</label>
                    <Input
                      type="date"
                      value={formData.accreditation_date}
                      onChange={(e) =>
                        setFormData({ ...formData, accreditation_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium">Monto Bruto</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.gross_amount}
                      onChange={(e) =>
                        setFormData({ ...formData, gross_amount: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Comisión (%)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.commission_percentage}
                      onChange={(e) =>
                        setFormData({ ...formData, commission_percentage: e.target.value })
                      }
                      placeholder="3.00"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Cuotas</label>
                    <Input
                      type="number"
                      value={formData.installments}
                      onChange={(e) =>
                        setFormData({ ...formData, installments: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Número de Lote (opcional)</label>
                  <Input
                    value={formData.batch_number}
                    onChange={(e) =>
                      setFormData({ ...formData, batch_number: e.target.value })
                    }
                    placeholder="Número de lote del resumen"
                  />
                </div>

                <Button
                  onClick={() => createMovement.mutate(formData)}
                  disabled={createMovement.isPending}
                  className="w-full"
                >
                  {createMovement.isPending ? "Registrando..." : "Registrar Movimiento"}
                </Button>
              </div>
          </DialogContent>
          </Dialog>
        </div>

        <Alert className="border-blue-500/50 bg-blue-500/10">
          <AlertTriangle className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-600">Próximamente: Sincronización Automática</AlertTitle>
          <AlertDescription className="text-blue-600/80">
            Pronto podrás sincronizar automáticamente los movimientos con Prisma Medios de Pago, 
            Mercado Pago, Naranja X y otras procesadoras para conciliación automática.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-6 bg-card rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <p className="text-sm font-medium text-muted-foreground">
                Pendientes de Acreditación
              </p>
            </div>
            <p className="text-2xl font-bold">{pendingMovements.length}</p>
            <p className="text-sm text-muted-foreground mt-1">
              ${totalPending.toFixed(2)}
            </p>
          </div>

          <div className="p-6 bg-card rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-muted-foreground">
                Acreditados
              </p>
            </div>
            <p className="text-2xl font-bold">{accreditedMovements.length}</p>
          </div>

          <div className="p-6 bg-card rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5 text-red-600" />
              <p className="text-sm font-medium text-muted-foreground">
                Total Comisiones
              </p>
            </div>
            <p className="text-2xl font-bold text-red-600">
              ${totalCommissions.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha Venta</TableHead>
                <TableHead>Tarjeta</TableHead>
                <TableHead>Acreditación</TableHead>
                <TableHead className="text-right">Monto Bruto</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">Monto Neto</TableHead>
                <TableHead>Cuotas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : movements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              ) : (
                movements?.map((movement: any) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {format(new Date(movement.sale_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        <div>
                          <div className="font-medium capitalize">
                            {movement.card_brand}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {movement.card_type === "credit" ? "Crédito" : "Débito"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(movement.accreditation_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${movement.gross_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      -{movement.commission_percentage}%
                      <br />
                      <span className="text-xs">
                        (${movement.commission_amount.toFixed(2)})
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      ${movement.net_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>{movement.installments}x</TableCell>
                    <TableCell>
                      <Badge
                        variant={movement.status === "accredited" ? "default" : "secondary"}
                      >
                        {movement.status === "accredited" ? "Acreditado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {movement.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsAccredited.mutate(movement.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Acreditar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
