import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Download } from "lucide-react";
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

export default function Retentions() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    retention_type: "iibb",
    retention_date: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    percentage: "",
    certificate_number: "",
    jurisdiction: "",
    description: "",
  });

  const { data: retentions, isLoading } = useQuery({
    queryKey: ["retentions", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retentions")
        .select(`
          *,
          customer:customers(name),
          supplier:suppliers(name)
        `)
        .eq("company_id", currentCompany?.id)
        .order("retention_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const createRetention = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from("retentions")
        .insert({
          ...data,
          company_id: currentCompany?.id,
          amount: parseFloat(data.amount),
          percentage: parseFloat(data.percentage),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retentions"] });
      toast.success("Retención registrada");
      setIsDialogOpen(false);
      setFormData({
        retention_type: "iibb",
        retention_date: format(new Date(), "yyyy-MM-dd"),
        amount: "",
        percentage: "",
        certificate_number: "",
        jurisdiction: "",
        description: "",
      });
    },
    onError: (error) => {
      toast.error("Error al registrar retención");
      console.error(error);
    },
  });

  const getRetentionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      iibb: "Ingresos Brutos",
      ganancias: "Ganancias",
      iva: "IVA",
      suss: "SUSS",
    };
    return labels[type] || type;
  };

  const getRetentionTypeBadge = (type: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      iibb: "default",
      ganancias: "secondary",
      iva: "destructive",
      suss: "outline",
    };
    return variants[type] || "default";
  };

  const totalRetentions = retentions?.reduce((sum: number, r: any) => sum + r.amount, 0) || 0;
  const retentionsByType = retentions?.reduce((acc: any, r: any) => {
    acc[r.retention_type] = (acc[r.retention_type] || 0) + r.amount;
    return acc;
  }, {});

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Retenciones</h1>
            <p className="text-muted-foreground">
              Gestión de retenciones fiscales
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar AFIP
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Retención
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nueva Retención</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Tipo de Retención</label>
                      <Select
                        value={formData.retention_type}
                        onValueChange={(value) =>
                          setFormData({ ...formData, retention_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iibb">Ingresos Brutos</SelectItem>
                          <SelectItem value="ganancias">Ganancias</SelectItem>
                          <SelectItem value="iva">IVA</SelectItem>
                          <SelectItem value="suss">SUSS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Fecha de Retención</label>
                      <Input
                        type="date"
                        value={formData.retention_date}
                        onChange={(e) =>
                          setFormData({ ...formData, retention_date: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                      <label className="text-sm font-medium">Porcentaje</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.percentage}
                        onChange={(e) =>
                          setFormData({ ...formData, percentage: e.target.value })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Número de Certificado</label>
                      <Input
                        value={formData.certificate_number}
                        onChange={(e) =>
                          setFormData({ ...formData, certificate_number: e.target.value })
                        }
                        placeholder="Número del comprobante"
                      />
                    </div>

                    {formData.retention_type === "iibb" && (
                      <div>
                        <label className="text-sm font-medium">Jurisdicción</label>
                        <Select
                          value={formData.jurisdiction}
                          onValueChange={(value) =>
                            setFormData({ ...formData, jurisdiction: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar jurisdicción" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CABA">CABA</SelectItem>
                            <SelectItem value="Buenos Aires">Buenos Aires</SelectItem>
                            <SelectItem value="Córdoba">Córdoba</SelectItem>
                            <SelectItem value="Santa Fe">Santa Fe</SelectItem>
                            <SelectItem value="Mendoza">Mendoza</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Descripción</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Detalles de la retención"
                    />
                  </div>

                  <Button
                    onClick={() => createRetention.mutate(formData)}
                    disabled={createRetention.isPending}
                    className="w-full"
                  >
                    {createRetention.isPending ? "Registrando..." : "Registrar Retención"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="p-6 bg-card rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                Total Retenciones
              </p>
            </div>
            <p className="text-2xl font-bold">${totalRetentions.toFixed(2)}</p>
          </div>

          {Object.entries(retentionsByType || {}).map(([type, amount]: [string, any]) => (
            <div key={type} className="p-6 bg-card rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  {getRetentionTypeLabel(type)}
                </p>
              </div>
              <p className="text-2xl font-bold">${amount.toFixed(2)}</p>
            </div>
          ))}
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Certificado</TableHead>
                <TableHead>Jurisdicción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Porcentaje</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : retentions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No hay retenciones registradas
                  </TableCell>
                </TableRow>
              ) : (
                retentions?.map((retention: any) => (
                  <TableRow key={retention.id}>
                    <TableCell>
                      {format(new Date(retention.retention_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRetentionTypeBadge(retention.retention_type)}>
                        {getRetentionTypeLabel(retention.retention_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{retention.certificate_number || "-"}</TableCell>
                    <TableCell>{retention.jurisdiction || "-"}</TableCell>
                    <TableCell className="text-right font-mono">
                      ${retention.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {retention.percentage}%
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {retention.description || "-"}
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
