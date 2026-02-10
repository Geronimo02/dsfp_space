import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Check {
  id: string;
  check_number: string;
  bank_name: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  type: string;
  customer_id?: string;
  supplier_id?: string;
  notes?: string;
}

export default function Checks() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    check_number: "",
    bank_name: "",
    amount: "",
    issue_date: format(new Date(), "yyyy-MM-dd"),
    due_date: format(new Date(), "yyyy-MM-dd"),
    status: "pending",
    type: "received",
    notes: "",
  });

  const { data: checks, isLoading } = useQuery({
    queryKey: ["checks", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checks")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as Check[];
    },
    enabled: !!currentCompany?.id,
  });

  const createCheck = useMutation({
    mutationFn: async (checkData: typeof formData) => {
      const { error } = await supabase.from("checks").insert({
        ...checkData,
        amount: parseFloat(checkData.amount),
        company_id: currentCompany?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      toast.success("Cheque registrado exitosamente");
      setIsDialogOpen(false);
      setFormData({
        check_number: "",
        bank_name: "",
        amount: "",
        issue_date: format(new Date(), "yyyy-MM-dd"),
        due_date: format(new Date(), "yyyy-MM-dd"),
        status: "pending",
        type: "received",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error("Error al registrar cheque");
      console.error(error);
    },
  });

  const updateCheckStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("checks")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checks"] });
      toast.success("Estado actualizado");
    },
    onError: () => {
      toast.error("Error al actualizar estado");
    },
  });

  const filteredChecks = checks?.filter(
    (check) =>
      check.check_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      check.bank_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "default",
      deposited: "secondary",
      cashed: "secondary",
      rejected: "destructive",
      cancelled: "outline",
    } as const;

    const labels = {
      pending: "Pendiente",
      deposited: "Depositado",
      cashed: "Cobrado",
      rejected: "Rechazado",
      cancelled: "Cancelado",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    return (
      <Badge variant={type === "received" ? "default" : "secondary"}>
        {type === "received" ? "Recibido" : "Emitido"}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Cheques</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Administra los cheques recibidos y emitidos
            </p>
          </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Cheque
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Cheque</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Número de Cheque</Label>
                <Input
                  value={formData.check_number}
                  onChange={(e) =>
                    setFormData({ ...formData, check_number: e.target.value })
                  }
                  placeholder="00000000"
                />
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) =>
                    setFormData({ ...formData, bank_name: e.target.value })
                  }
                  placeholder="Nombre del banco"
                />
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="received">Recibido</SelectItem>
                    <SelectItem value="issued">Emitido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de Emisión</Label>
                <Input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) =>
                    setFormData({ ...formData, issue_date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Vencimiento</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notas</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Observaciones adicionales"
                />
              </div>
            </div>
            <Button
              onClick={() => createCheck.mutate(formData)}
              disabled={
                !formData.check_number ||
                !formData.bank_name ||
                !formData.amount
              }
            >
              Registrar Cheque
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por número o banco..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filteredChecks?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No hay cheques registrados
                </TableCell>
              </TableRow>
            ) : (
              filteredChecks?.map((check) => (
                <TableRow key={check.id}>
                  <TableCell className="font-medium">
                    {check.check_number}
                  </TableCell>
                  <TableCell>{check.bank_name}</TableCell>
                  <TableCell>{getTypeBadge(check.type)}</TableCell>
                  <TableCell>${check.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(check.issue_date), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(check.due_date), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(check.status)}</TableCell>
                  <TableCell>
                    {check.status === "pending" && (
                      <Select
                        onValueChange={(value) =>
                          updateCheckStatus.mutate({
                            id: check.id,
                            status: value,
                          })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Cambiar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposited">Depositado</SelectItem>
                          <SelectItem value="cashed">Cobrado</SelectItem>
                          <SelectItem value="rejected">Rechazado</SelectItem>
                          <SelectItem value="cancelled">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
    </Layout>
  );
}
