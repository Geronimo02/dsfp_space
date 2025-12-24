import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserCog, Mail, UserPlus } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  cashier: "Cajero",
  accountant: "Contador",
  viewer: "Visualizador",
  warehouse: "Depósito",
  technician: "Técnico",
  auditor: "Auditor",
  employee: "Empleado",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  manager: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  cashier: "bg-green-500/10 text-green-500 border-green-500/20",
  accountant: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  warehouse: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  technician: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  auditor: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  viewer: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  employee: "bg-slate-500/10 text-slate-500 border-slate-500/20",
};

export function EmployeeRoleAssignment() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("employee");

  // Fetch company users with their roles
  const { data: companyUsers, isLoading } = useQuery({
    queryKey: ["company-users", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("company_users")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch employees to match with users
  const { data: employees } = useQuery({
    queryKey: ["employees-for-roles", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      // Prevent changing own role from the client side
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === userId) {
        throw new Error("No puedes cambiar tu propio rol");
      }

      const { error } = await supabase
        .from("company_users")
        .update({ role: newRole })
        .eq("user_id", userId)
        .eq("company_id", currentCompany?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Rol actualizado correctamente");
    },
    onError: (error: any) => {
      toast.error("Error al actualizar rol: " + error.message);
    },
  });

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (mounted) setAuthUserId(user?.id ?? null);
    })();
    return () => { mounted = false; };
  }, []);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error("No company selected");
      
      // Call edge function to invite employee
      const { data, error } = await supabase.functions.invoke("invite-employee", {
        body: {
          email: inviteEmail,
          role: inviteRole,
          companyId: currentCompany.id,
          companyName: currentCompany.name,
        },
      });

      if (error) {
        const ctx = (error as any)?.context;
        const rawBody = ctx?.body;
        const bodyObj =
          typeof rawBody === "string"
            ? (() => {
                try {
                  return JSON.parse(rawBody);
                } catch {
                  return null;
                }
              })()
            : rawBody;

        const message =
          bodyObj?.error || ctx?.error || (error as any)?.message || "Error al enviar invitación";

        // If the user is already in the company, treat it as a non-fatal outcome.
        if (typeof message === "string" && message.includes("ya pertenece a esta empresa")) {
          return { already_member: true, message };
        }

        throw new Error(message);
      }

      return data;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });

      if (result?.already_member) {
        toast.info(result?.message || "El usuario ya pertenece a esta empresa");
      } else if (result?.email_sent) {
        toast.success("Invitación enviada correctamente. El usuario recibirá un email para configurar su contraseña.");
      } else if (result?.set_password_link) {
        // Email not sent - show link to share manually
        toast.success(
          <div>
            <p>Usuario creado correctamente.</p>
            <p className="text-sm mt-1">Comparte este enlace para que configure su contraseña:</p>
            <code className="text-xs bg-muted p-1 rounded block mt-1 break-all">
              {result.set_password_link}
            </code>
          </div>,
          { duration: 15000 }
        );
      } else {
        toast.success("Usuario invitado correctamente");
      }

      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("employee");
    },
    onError: (error: any) => {
      toast.error("Error al enviar invitación: " + error.message);
    },
  });

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <CardTitle>Asignación de Roles</CardTitle>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invitar Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invitar Usuario a la Empresa</DialogTitle>
                <DialogDescription>
                  Envía una invitación por email para que el usuario se una a la empresa
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="empleado@ejemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Rol</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => inviteMutation.mutate()}
                  disabled={!inviteEmail || inviteMutation.isPending}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {inviteMutation.isPending ? "Enviando..." : "Enviar Invitación"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Asigna roles a los usuarios de la empresa para controlar sus permisos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {companyUsers && companyUsers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol Actual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cambiar Rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companyUsers.map((user) => {
                // Try to find matching employee
                const employee = employees?.find(e => e.email === user.user_id);
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {employee ? `${employee.first_name} ${employee.last_name}` : "Usuario"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ID: {user.user_id.slice(0, 8)}...
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ROLE_COLORS[user.role] || ""}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active ? "default" : "secondary"}>
                        {user.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => {
                          if (authUserId && authUserId === user.user_id) {
                            toast.error("No puedes cambiar tu propio rol");
                            return;
                          }
                          updateRoleMutation.mutate({
                            userId: user.user_id,
                            newRole: newRole as AppRole,
                          });
                        }}
                        disabled={updateRoleMutation.isPending || (authUserId === user.user_id)}
                      >
                        <SelectTrigger className="w-40" title={authUserId === user.user_id ? "No puedes cambiar tu propio rol" : undefined}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <UserCog className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay usuarios en la empresa</h3>
            <p className="text-muted-foreground mb-4">
              Invita usuarios para asignarles roles
            </p>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invitar Usuario
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
