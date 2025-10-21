import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sanitizeSearchQuery } from "@/lib/searchUtils";

export default function AuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const { hasPermission, isAdmin, isManager } = usePermissions();

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["audit-logs", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`table_name.ilike.%${sanitized}%,user_email.ilike.%${sanitized}%,user_name.ilike.%${sanitized}%`);
        }
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
            No tienes permisos para ver los registros de auditoría. Solo administradores y gerentes pueden acceder.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      INSERT: "default",
      UPDATE: "secondary",
      DELETE: "destructive",
    };
    return <Badge variant={variants[action] || "default"}>{action}</Badge>;
  };

  const getTableNameLabel = (tableName: string) => {
    const labels: Record<string, string> = {
      products: "Productos",
      customers: "Clientes",
      sales: "Ventas",
      purchases: "Compras",
      suppliers: "Proveedores",
      user_roles: "Roles de Usuario",
    };
    return labels[tableName] || tableName;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Auditoría de Cambios</h1>
          <p className="text-muted-foreground">
            Historial completo de todas las modificaciones en el sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Registros de Auditoría
            </CardTitle>
            <CardDescription>
              Últimas 100 modificaciones en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tabla, usuario o email..."
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
                    <TableHead>Tabla</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Campos Modificados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Cargando registros...
                      </TableCell>
                    </TableRow>
                  ) : auditLogs && auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
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
                        <TableCell>{getTableNameLabel(log.table_name)}</TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          {log.changed_fields && log.changed_fields.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {log.changed_fields.map((field, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No hay registros de auditoría
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
