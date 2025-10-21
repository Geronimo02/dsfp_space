import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ServiceStatus = "received" | "in_diagnosis" | "in_repair" | "ready" | "delivered";

interface TechnicalService {
  id: string;
  service_number: string;
  customer_id: string | null;
  device_type: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  reported_issue: string;
  diagnosis: string | null;
  status: ServiceStatus;
  received_date: string;
  estimated_completion_date: string | null;
  completed_date: string | null;
  delivered_date: string | null;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  notes: string | null;
  user_id: string;
  created_at: string;
  customers?: { name: string } | null;
}

const statusLabels: Record<ServiceStatus, string> = {
  received: "Recibido",
  in_diagnosis: "En diagnóstico",
  in_repair: "En reparación",
  ready: "Listo",
  delivered: "Entregado",
};

const statusColors: Record<ServiceStatus, string> = {
  received: "bg-blue-500",
  in_diagnosis: "bg-yellow-500",
  in_repair: "bg-orange-500",
  ready: "bg-green-500",
  delivered: "bg-gray-500",
};

export default function TechnicalServices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<TechnicalService | null>(null);
  const [formData, setFormData] = useState({
    customer_id: "",
    device_type: "",
    brand: "",
    model: "",
    serial_number: "",
    reported_issue: "",
    diagnosis: "",
    status: "received" as ServiceStatus,
    estimated_completion_date: "",
    labor_cost: "0",
    parts_cost: "0",
    notes: "",
  });

  const queryClient = useQueryClient();

  const { data: services = [] } = useQuery({
    queryKey: ["technical-services", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("technical_services")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(
          `service_number.ilike.%${searchQuery}%,device_type.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as TechnicalService[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuario no autenticado");

      const { data: serviceNumber } = await supabase.rpc("generate_service_number");

      const totalCost = parseFloat(data.labor_cost) + parseFloat(data.parts_cost);

      const { error } = await supabase.from("technical_services").insert({
        service_number: serviceNumber,
        customer_id: data.customer_id || null,
        device_type: data.device_type,
        brand: data.brand || null,
        model: data.model || null,
        serial_number: data.serial_number || null,
        reported_issue: data.reported_issue,
        diagnosis: data.diagnosis || null,
        status: data.status,
        estimated_completion_date: data.estimated_completion_date || null,
        labor_cost: parseFloat(data.labor_cost),
        parts_cost: parseFloat(data.parts_cost),
        total_cost: totalCost,
        notes: data.notes || null,
        user_id: user.user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-services"] });
      toast.success("Servicio técnico creado exitosamente");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Error al crear el servicio: " + error.message);
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const totalCost = parseFloat(data.labor_cost) + parseFloat(data.parts_cost);

      const updateData: any = {
        customer_id: data.customer_id || null,
        device_type: data.device_type,
        brand: data.brand || null,
        model: data.model || null,
        serial_number: data.serial_number || null,
        reported_issue: data.reported_issue,
        diagnosis: data.diagnosis || null,
        status: data.status,
        estimated_completion_date: data.estimated_completion_date || null,
        labor_cost: parseFloat(data.labor_cost),
        parts_cost: parseFloat(data.parts_cost),
        total_cost: totalCost,
        notes: data.notes || null,
      };

      if (data.status === "ready" && !editingService?.completed_date) {
        updateData.completed_date = new Date().toISOString();
      }
      if (data.status === "delivered" && !editingService?.delivered_date) {
        updateData.delivered_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from("technical_services")
        .update(updateData)
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technical-services"] });
      toast.success("Servicio actualizado exitosamente");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Error al actualizar el servicio: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      customer_id: "",
      device_type: "",
      brand: "",
      model: "",
      serial_number: "",
      reported_issue: "",
      diagnosis: "",
      status: "received",
      estimated_completion_date: "",
      labor_cost: "0",
      parts_cost: "0",
      notes: "",
    });
    setEditingService(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      updateServiceMutation.mutate({ ...formData, id: editingService.id });
    } else {
      createServiceMutation.mutate(formData);
    }
  };

  const handleEdit = (service: TechnicalService) => {
    setEditingService(service);
    setFormData({
      customer_id: service.customer_id || "",
      device_type: service.device_type,
      brand: service.brand || "",
      model: service.model || "",
      serial_number: service.serial_number || "",
      reported_issue: service.reported_issue,
      diagnosis: service.diagnosis || "",
      status: service.status,
      estimated_completion_date: service.estimated_completion_date
        ? format(new Date(service.estimated_completion_date), "yyyy-MM-dd")
        : "",
      labor_cost: service.labor_cost.toString(),
      parts_cost: service.parts_cost.toString(),
      notes: service.notes || "",
    });
    setDialogOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Servicios Técnicos</h1>
            <p className="text-muted-foreground">Gestión de reparaciones y servicios</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Servicio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Editar Servicio" : "Nuevo Servicio Técnico"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer_id">Cliente</Label>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, customer_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin cliente</SelectItem>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: ServiceStatus) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="device_type">Tipo de Equipo *</Label>
                    <Input
                      id="device_type"
                      value={formData.device_type}
                      onChange={(e) =>
                        setFormData({ ...formData, device_type: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="serial_number">Número de Serie</Label>
                    <Input
                      id="serial_number"
                      value={formData.serial_number}
                      onChange={(e) =>
                        setFormData({ ...formData, serial_number: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reported_issue">Problema Reportado *</Label>
                  <Textarea
                    id="reported_issue"
                    value={formData.reported_issue}
                    onChange={(e) =>
                      setFormData({ ...formData, reported_issue: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Diagnóstico</Label>
                  <Textarea
                    id="diagnosis"
                    value={formData.diagnosis}
                    onChange={(e) =>
                      setFormData({ ...formData, diagnosis: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estimated_completion_date">Fecha Estimada de Entrega</Label>
                  <Input
                    id="estimated_completion_date"
                    type="date"
                    value={formData.estimated_completion_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimated_completion_date: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="labor_cost">Costo de Mano de Obra</Label>
                    <Input
                      id="labor_cost"
                      type="number"
                      step="0.01"
                      value={formData.labor_cost}
                      onChange={(e) =>
                        setFormData({ ...formData, labor_cost: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parts_cost">Costo de Repuestos</Label>
                    <Input
                      id="parts_cost"
                      type="number"
                      step="0.01"
                      value={formData.parts_cost}
                      onChange={(e) =>
                        setFormData({ ...formData, parts_cost: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas Adicionales</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingService ? "Actualizar" : "Crear"} Servicio
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número de servicio o equipo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Problema</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Recibido</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">
                        {service.service_number}
                      </TableCell>
                      <TableCell>{service.customers?.name || "Sin cliente"}</TableCell>
                      <TableCell>
                        {service.device_type}
                        {service.brand && ` - ${service.brand}`}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {service.reported_issue}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[service.status]}>
                          {statusLabels[service.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(service.received_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>${service.total_cost.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(service)}
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {services.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No se encontraron servicios técnicos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
