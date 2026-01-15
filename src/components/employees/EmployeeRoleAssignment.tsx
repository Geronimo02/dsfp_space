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
        .eq("company_id", currentCompany.id);
      
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

  const companyUserIds = companyUsers?.map((user) => user.user_id).filter(Boolean) || [];
  const normalizeEmail = (email?: string | null) => (email || "").trim().toLowerCase();
  const employeeEmails = (employees || [])
    .map((employee) => normalizeEmail(employee.email))
    .filter((email) => email.length > 0);

  const { data: profilesById } = useQuery({
    queryKey: ["company-user-profiles", currentCompany?.id, companyUserIds],
    queryFn: async () => {
      if (!currentCompany?.id || companyUserIds.length === 0) return {};

      const supabaseClient = supabase as any;
      const { data, error } = await supabaseClient
        .from("profiles")
        .select("id, email")
        .in("id", companyUserIds);

      if (error) throw error;

      return (data || []).reduce((acc: Record<string, { id: string; email: string | null }>, profile: { id: string; email: string | null }) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
    },
    enabled: !!currentCompany?.id && companyUserIds.length > 0,
  });

  const { data: employeeRoleItems } = useQuery({
    queryKey: ["company-users-roles", currentCompany?.id, employeeEmails],
    queryFn: async () => {
      if (!currentCompany?.id || employeeEmails.length === 0) return [];

      const { data, error } = await supabase.functions.invoke("company-users-roles", {
        body: {
          companyId: currentCompany.id,
          emails: employeeEmails,
        },
      });
      if (error) throw error;

      return (data as any)?.items || [];
    },
    enabled: !!currentCompany?.id && employeeEmails.length > 0,
  });

  const roleByEmail = new Map<
    string,
    { email: string; user_id: string | null; role: AppRole | null; active: boolean | null }
  >();
  (employeeRoleItems || []).forEach((item: any) => {
    const email = normalizeEmail(item?.email);
    if (email) {
      roleByEmail.set(email, {
        email,
        user_id: item?.user_id ?? null,
        role: item?.role ?? null,
        active: item?.active ?? null,
      });
    }
  });

  const matchedUserIds = new Set<string>();
  const employeeRows = (employees || []).map((employee) => {
    const normalizedEmail = normalizeEmail(employee.email);
    const roleInfo = normalizedEmail ? roleByEmail.get(normalizedEmail) : undefined;
    const userId = roleInfo?.user_id ?? null;
    if (userId) matchedUserIds.add(userId);
    return {
      employee,
      email: employee.email ?? roleInfo?.email ?? null,
      userId,
      role: roleInfo?.role ?? null,
      active: roleInfo?.active ?? null,
    };
  });

  const orphanUserRows = (companyUsers || [])
    .filter((user) => !matchedUserIds.has(user.user_id))
    .map((user) => {
      const profile = profilesById?.[user.user_id];
      return {
        employee: null,
        email: profile?.email ?? null,
        userId: user.user_id,
        role: user.role,
        active: user.active ?? null,
      };
    });

  const roleRows = [...employeeRows, ...orphanUserRows];

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
      queryClient.invalidateQueries({ queryKey: ["company-users-roles"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
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
      queryClient.invalidateQueries({ queryKey: ["company-users-roles"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });

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

  const handleInviteForEmployee = (email?: string | null) => {
    if (!email) {
      toast.error("El empleado no tiene email para invitar");
      return;
    }
    setInviteEmail(email);
    setInviteRole("employee");
    setInviteDialogOpen(true);
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
        {roleRows.length > 0 ? (
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
              {roleRows.map((row) => {
                const employee = row.employee;
                const displayEmail = row.email || employee?.email || null;
                const hasMembership = !!row.userId && !!row.role;
                
                return (
                  <TableRow key={row.userId || employee?.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {employee ? `${employee.first_name} ${employee.last_name}` : "Usuario"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {hasMembership && row.userId
                            ? `ID: ${row.userId.slice(0, 8)}...`
                            : displayEmail || "Sin email"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasMembership && row.role ? (
                        <Badge className={ROLE_COLORS[row.role] || ""}>
                          {ROLE_LABELS[row.role] || row.role}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Sin rol</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasMembership ? (
                        <Badge variant={row.active ? "default" : "secondary"}>
                          {row.active ? "Activo" : "Inactivo"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Sin usuario</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasMembership && row.role ? (
                        <Select
                          value={row.role}
                          onValueChange={(newRole) => {
                            if (authUserId && authUserId === row.userId) {
                              toast.error("No puedes cambiar tu propio rol");
                              return;
                            }
                            updateRoleMutation.mutate({
                              userId: row.userId as string,
                              newRole: newRole as AppRole,
                            });
                          }}
                          disabled={updateRoleMutation.isPending || (authUserId === row.userId)}
                        >
                          <SelectTrigger className="w-40" title={authUserId === row.userId ? "No puedes cambiar tu propio rol" : undefined}>
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
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleInviteForEmployee(displayEmail)}
                        >
                          Invitar
                        </Button>
                      )}
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
