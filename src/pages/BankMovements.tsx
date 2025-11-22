import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowRightLeft, CheckCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import { format } from "date-fns";

export default function BankMovements() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    bank_account_id: "",
    movement_type: "deposit",
    amount: "",
    reference: "",
    description: "",
    destination_account_id: "",
  });

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("active", true)
        .order("bank_name");

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: movements, isLoading } = useQuery({
    queryKey: ["bank-movements", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements")
        .select(`
          *,
          bank_account:bank_accounts!bank_movements_bank_account_id_fkey(bank_name, account_number),
          destination:bank_accounts!bank_movements_destination_account_id_fkey(bank_name, account_number)
        `)
        .eq("company_id", currentCompany?.id)
        .order("movement_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const createMovement = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("bank_movements")
        .insert({
          ...data,
          company_id: currentCompany?.id,
          user_id: user?.id,
          amount: parseFloat(data.amount),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-movements"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success("Movimiento registrado");
      setIsDialogOpen(false);
      setFormData({
        bank_account_id: "",
        movement_type: "deposit",
        amount: "",
        reference: "",
        description: "",
        destination_account_id: "",
      });
    },
    onError: (error) => {
      toast.error("Error al registrar movimiento");
      console.error(error);
    },
  });

  const reconcileMovement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bank_movements")
        .update({
          reconciled: true,
          reconciliation_date: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-movements"] });
      toast.success("Movimiento conciliado");
    },
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "deposit":
      case "transfer_in":
        return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case "withdrawal":
      case "transfer_out":
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      default:
        return <ArrowRightLeft className="h-4 w-4" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      deposit: "Depósito",
      withdrawal: "Extracción",
      transfer_in: "Transferencia Recibida",
      transfer_out: "Transferencia Enviada",
    };
    return labels[type] || type;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Movimientos Bancarios</h1>
            <p className="text-muted-foreground">
              Registra y concilia movimientos bancarios
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Movimiento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo Movimiento Bancario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Cuenta Bancaria</label>
                  <Select
                    value={formData.bank_account_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, bank_account_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.map((account: any) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.bank_name} - {account.account_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Tipo de Movimiento</label>
                  <Select
                    value={formData.movement_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, movement_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deposit">Depósito</SelectItem>
                      <SelectItem value="withdrawal">Extracción</SelectItem>
                      <SelectItem value="transfer_out">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.movement_type === "transfer_out" && (
                  <div>
                    <label className="text-sm font-medium">Cuenta Destino</label>
                    <Select
                      value={formData.destination_account_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, destination_account_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cuenta destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          ?.filter((a: any) => a.id !== formData.bank_account_id)
                          .map((account: any) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.bank_name} - {account.account_number}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Monto</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Referencia</label>
                  <Input
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData({ ...formData, reference: e.target.value })
                    }
                    placeholder="Número de comprobante, cheque, etc."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Descripción</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Detalles del movimiento"
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

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : movements?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    No hay movimientos registrados
                  </TableCell>
                </TableRow>
              ) : (
                movements?.map((movement: any) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {format(new Date(movement.movement_date), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      {movement.bank_account?.bank_name}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {movement.bank_account?.account_number}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getMovementIcon(movement.movement_type)}
                        {getMovementTypeLabel(movement.movement_type)}
                      </div>
                    </TableCell>
                    <TableCell>{movement.reference || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {movement.description || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={
                          movement.movement_type === "deposit" ||
                          movement.movement_type === "transfer_in"
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {movement.movement_type === "deposit" ||
                        movement.movement_type === "transfer_in"
                          ? "+"
                          : "-"}
                        ${movement.amount.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={movement.reconciled ? "default" : "secondary"}>
                        {movement.reconciled ? "Conciliado" : "Pendiente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!movement.reconciled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => reconcileMovement.mutate(movement.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Conciliar
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
