import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, Calendar, AlertCircle } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TimeEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
}

export function EmployeeSelfTimeTracking() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  // Get current user
  const { data: user } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get employee record for current user
  const { data: employee } = useQuery({
    queryKey: ["current-employee", user?.email, currentCompany?.id],
    queryFn: async () => {
      if (!user?.email || !currentCompany?.id) return null;
      
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("email", user.email)
        .eq("active", true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.email && !!currentCompany?.id,
  });

  // Get today's time entries
  const { data: todayEntries, isLoading } = useQuery({
    queryKey: ["my-time-entries", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      
      const today = new Date();
      const start = startOfDay(today);
      const end = endOfDay(today);
      
      const { data, error } = await supabase
        .from("employee_time_entries" as any)
        .select("*")
        .eq("employee_id", employee.id)
        .gte("clock_in", start.toISOString())
        .lte("clock_in", end.toISOString())
        .order("clock_in", { ascending: false });
      
      if (error) throw error;
      return data as unknown as TimeEntry[];
    },
    enabled: !!employee?.id,
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id || !currentCompany?.id) throw new Error("No se encontró información del empleado");
      
      const now = new Date();
      const { error } = await supabase
        .from("employee_time_entries" as any)
        .insert({
          company_id: currentCompany.id,
          employee_id: employee.id,
          clock_in: now.toISOString(),
          notes: notes || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-time-entries"] });
      toast.success("✅ Entrada registrada correctamente");
      setNotes("");
    },
    onError: (error: any) => {
      toast.error("Error al registrar entrada: " + error.message);
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const now = new Date();
      const { error } = await supabase
        .from("employee_time_entries" as any)
        .update({ 
          clock_out: now.toISOString(),
          notes: notes || null,
        })
        .eq("id", entryId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-time-entries"] });
      toast.success("✅ Salida registrada correctamente");
      setNotes("");
    },
    onError: (error: any) => {
      toast.error("Error al registrar salida: " + error.message);
    },
  });

  const calculateHours = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return "En progreso...";
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const activeEntry = todayEntries?.find(entry => !entry.clock_out);
  const completedEntries = todayEntries?.filter(entry => entry.clock_out) || [];

  if (!employee) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No se encontró tu perfil de empleado vinculado a tu cuenta. 
              Contacta a tu administrador para que te vincule correctamente.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded" />
            <div className="h-32 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <CardTitle>Mi Control de Horarios</CardTitle>
        </div>
        <CardDescription>
          Registra tu entrada y salida
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Clock In/Out Section */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-6 space-y-4">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2 tabular-nums">
              {format(currentTime, "HH:mm:ss")}
            </div>
            <div className="text-muted-foreground flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(currentTime, "EEEE, dd 'de' MMMM yyyy", { locale: es })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Llegué tarde por tráfico"
            />
          </div>

          <div className="grid gap-3">
            {activeEntry ? (
              <>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <LogIn className="h-5 w-5 text-green-600" />
                    <span className="font-semibold">Entrada registrada</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {format(new Date(activeEntry.clock_in), "HH:mm", { locale: es })}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {calculateHours(activeEntry.clock_in, null)}
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={() => clockOutMutation.mutate(activeEntry.id)}
                  disabled={clockOutMutation.isPending}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  {clockOutMutation.isPending ? "Registrando salida..." : "Registrar Salida"}
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                onClick={() => clockInMutation.mutate()}
                disabled={clockInMutation.isPending}
                className="w-full"
              >
                <LogIn className="mr-2 h-5 w-5" />
                {clockInMutation.isPending ? "Registrando entrada..." : "Registrar Entrada"}
              </Button>
            )}
          </div>
        </div>

        {/* Today's History */}
        {completedEntries.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Historial de hoy</h3>
            <div className="space-y-2">
              {completedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Entrada</div>
                      <div className="font-semibold text-green-600">
                        {format(new Date(entry.clock_in), "HH:mm")}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Salida</div>
                      <div className="font-semibold text-red-600">
                        {entry.clock_out ? format(new Date(entry.clock_out), "HH:mm") : "-"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">
                      {calculateHours(entry.clock_in, entry.clock_out)}
                    </Badge>
                    {entry.notes && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                        {entry.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          💡 Tu supervisor puede ver estos registros para calcular tu asistencia y horas trabajadas
        </div>
      </CardContent>
    </Card>
  );
}
