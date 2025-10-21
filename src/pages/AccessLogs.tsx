import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Activity, User, Calendar, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AccessLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const { isAdmin, isManager } = usePermissions();

  const { data: accessLogs, isLoading } = useQuery({
    queryKey: ["access-logs", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchQuery) {
        query = query.or(`action.ilike.%${searchQuery}%,user_email.ilike.%${searchQuery}%,user_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (!isAdmin && !isManager) {
    return (
      <Layout>
        <Alert variant="destructive">
          <AlertDescription>
            No tienes permisos para ver los registros de acceso. Solo administradores y gerentes pueden acceder.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  const getActionBadge = (action: string) => {
    const labels: Record<string, string> = {
      login: "Inicio de sesión",
      logout: "Cierre de sesión",
      page_view: "Vista de página",
      api_call: "Llamada API",
    };
    return <Badge variant="outline">{labels[action] || action}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Registros de Acceso</h1>
          <p className="text-muted-foreground">
            Historial de accesos y actividad de usuarios en el sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Logs de Acceso
            </CardTitle>
            <CardDescription>
              Últimas 100 actividades registradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por acción, usuario o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Página/URL</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Cargando registros...
                      </TableCell>
                    </TableRow>
                  ) : accessLogs && accessLogs.length > 0 ? (
                    accessLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{log.user_name || "Sin nombre"}</span>
                              <span className="text-xs text-muted-foreground">{log.user_email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {log.page_url || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Exitoso</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-red-600">
                              <XCircle className="h-4 w-4" />
                              <span className="text-sm">Fallido</span>
                            </div>
                          )}
                          {log.error_message && (
                            <p className="text-xs text-muted-foreground mt-1">{log.error_message}</p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No hay registros de acceso
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
