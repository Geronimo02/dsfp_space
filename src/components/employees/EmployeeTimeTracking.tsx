import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, Plus, LogIn, LogOut, Calendar, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  employees?: {
    first_name: string;
    last_name: string;
  };
}

export function EmployeeTimeTracking() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [clockInTime, setClockInTime] = useState("09:00");
  const [clockOutTime, setClockOutTime] = useState("");
  const [notes, setNotes] = useState("");
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));

  // Fetch employees
  const { data: employees } = useQuery({
    queryKey: ["employees-for-time", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("company_id", currentCompany.id)
        .eq("active", true)
        .order("first_name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch time entries
  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ["time-entries", currentCompany?.id, filterMonth],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const [yearStr, monthStr] = filterMonth.split("-");
      const monthDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      
      const { data, error } = await supabase
        .from("employee_time_entries" as any)
        .select("*, employees(first_name, last_name)")
        .eq("company_id", currentCompany.id)
        .gte("clock_in", start.toISOString())
        .lte("clock_in", end.toISOString())
        .order("clock_in", { ascending: false });
      
      if (error) throw error;
      return data as unknown as TimeEntry[];
    },
    enabled: !!currentCompany?.id,
  });

  const createEntryMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !selectedEmployee) throw new Error("Datos incompletos");
      
      const clockInDateTime = new Date(`${selectedDate}T${clockInTime}:00`);
      const clockOutDateTime = clockOutTime ? new Date(`${selectedDate}T${clockOutTime}:00`) : null;
      
      const { error } = await supabase
        .from("employee_time_entries" as any)
        .insert({
          company_id: currentCompany.id,
          employee_id: selectedEmployee,
          clock_in: clockInDateTime.toISOString(),
          clock_out: clockOutDateTime?.toISOString() || null,
          notes: notes || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Registro de horario guardado");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("employee_time_entries" as any)
        .delete()
        .eq("id", entryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("Registro eliminado");
    },
    onError: (error: any) => {
      toast.error("Error al eliminar: " + error.message);
    },
  });

  const resetForm = () => {
    setSelectedEmployee("");
    setSelectedDate(new Date().toISOString().split("T")[0]);
    setClockInTime("09:00");
    setClockOutTime("");
    setNotes("");
  };

  const calculateHours = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "-";
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <CardTitle>Control de Horarios</CardTitle>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full sm:w-40"
            />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Registrar Horario</span>
                  <span className="sm:hidden">Registrar</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Entrada/Salida</DialogTitle>
                  <DialogDescription>
                    Registra el horario de entrada y salida de un empleado
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="employee">Empleado</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar empleado" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees?.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Fecha</Label>
                    <Input
                      id="date"
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clockIn">Hora Entrada *</Label>
                      <Input
                        id="clockIn"
                        type="time"
                        value={clockInTime}
                        onChange={(e) => setClockInTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clockOut">Hora Salida (opcional)</Label>
                      <Input
                        id="clockOut"
                        type="time"
                        value={clockOutTime}
                        onChange={(e) => setClockOutTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas (opcional)</Label>
                    <Input
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Llegó tarde por tráfico"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => createEntryMutation.mutate()}
                    disabled={!selectedEmployee || !clockInTime || createEntryMutation.isPending}
                  >
                    {createEntryMutation.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <CardDescription>
          Registro de entrada y salida de empleados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {timeEntries && timeEntries.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <LogIn className="h-4 w-4" />
                      Entrada
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <LogOut className="h-4 w-4" />
                      Salida
                    </div>
                  </TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.employees?.first_name} {entry.employees?.last_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(entry.clock_in), "dd/MM/yyyy", { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {format(new Date(entry.clock_in), "HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {entry.clock_out 
                        ? format(new Date(entry.clock_out), "HH:mm", { locale: es })
                        : <Badge variant="secondary">En progreso</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      {calculateHours(entry.clock_in, entry.clock_out)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {entry.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("¿Eliminar este registro?")) {
                            deleteEntryMutation.mutate(entry.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay registros de horario</h3>
            <p className="text-muted-foreground mb-4">
              Comienza registrando la entrada y salida de tus empleados
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Primer Horario
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
