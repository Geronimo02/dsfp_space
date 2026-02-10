import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Building2, CreditCard, Wallet } from "lucide-react";
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
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  currency: string;
  balance: number;
  active: boolean;
  created_at: string;
}

export default function BankAccounts() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    bank_name: "",
    account_number: "",
    account_type: "checking",
    currency: "ARS",
    balance: "0",
  });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["bank-accounts", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BankAccount[];
    },
    enabled: !!currentCompany?.id,
  });

  const createAccount = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("bank_accounts")
        .insert({
          ...data,
          company_id: currentCompany?.id,
          balance: parseFloat(data.balance),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success("Cuenta bancaria creada");
      setIsDialogOpen(false);
      setFormData({
        bank_name: "",
        account_number: "",
        account_type: "checking",
        currency: "ARS",
        balance: "0",
      });
    },
    onError: (error) => {
      toast.error("Error al crear cuenta bancaria");
      console.error(error);
    },
  });

  const toggleAccountStatus = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("bank_accounts")
        .update({ active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      toast.success("Estado actualizado");
    },
  });

  const filteredAccounts = accounts?.filter(
    (account) =>
      account.bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.account_number.includes(searchQuery)
  );

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case "savings":
        return <Wallet className="h-4 w-4" />;
      case "credit":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      checking: "Cuenta Corriente",
      savings: "Caja de Ahorro",
      credit: "Tarjeta de Crédito",
    };
    return labels[type] || type;
  };

  const totalBalance = accounts?.reduce((sum, acc) => sum + (acc.active ? acc.balance : 0), 0) || 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Cuentas Bancarias</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gestiona las cuentas bancarias de tu empresa
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cuenta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Cuenta Bancaria</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Banco</label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) =>
                      setFormData({ ...formData, bank_name: e.target.value })
                    }
                    placeholder="Nombre del banco"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Número de Cuenta</label>
                  <Input
                    value={formData.account_number}
                    onChange={(e) =>
                      setFormData({ ...formData, account_number: e.target.value })
                    }
                    placeholder="Número de cuenta"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Tipo de Cuenta</label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, account_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Cuenta Corriente</SelectItem>
                      <SelectItem value="savings">Caja de Ahorro</SelectItem>
                      <SelectItem value="credit">Tarjeta de Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Moneda</label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, currency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">ARS (Pesos)</SelectItem>
                      <SelectItem value="USD">USD (Dólares)</SelectItem>
                      <SelectItem value="EUR">EUR (Euros)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Saldo Inicial</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) =>
                      setFormData({ ...formData, balance: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>

                <Button
                  onClick={() => createAccount.mutate(formData)}
                  disabled={createAccount.isPending}
                  className="w-full"
                >
                  {createAccount.isPending ? "Creando..." : "Crear Cuenta"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-6 bg-card rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                Total Cuentas
              </p>
            </div>
            <p className="text-2xl font-bold">{accounts?.length || 0}</p>
          </div>

          <div className="p-6 bg-card rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-muted-foreground">
                Cuentas Activas
              </p>
            </div>
            <p className="text-2xl font-bold">
              {accounts?.filter((a) => a.active).length || 0}
            </p>
          </div>

          <div className="p-6 bg-card rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <p className="text-sm font-medium text-muted-foreground">
                Saldo Total
              </p>
            </div>
            <p className="text-2xl font-bold">
              ${totalBalance.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por banco o número de cuenta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead>Número de Cuenta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : filteredAccounts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No hay cuentas bancarias registradas
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts?.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.bank_name}
                    </TableCell>
                    <TableCell>{account.account_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getAccountTypeIcon(account.account_type)}
                        {getAccountTypeLabel(account.account_type)}
                      </div>
                    </TableCell>
                    <TableCell>{account.currency}</TableCell>
                    <TableCell className="text-right font-mono">
                      ${account.balance.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.active ? "default" : "secondary"}>
                        {account.active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleAccountStatus.mutate({
                            id: account.id,
                            active: !account.active,
                          })
                        }
                      >
                        {account.active ? "Desactivar" : "Activar"}
                      </Button>
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
