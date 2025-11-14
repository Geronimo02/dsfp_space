import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Search, Users, Shield, UserCheck, Database, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { usePermissions } from "@/hooks/usePermissions";  // Ensure imported

// Add local type definitions to avoid import conflicts
type AppRole = "admin" | "manager" | "cashier" | "accountant" | "viewer" | "employee" | "warehouse" | "technician" | "auditor";

type RolePermission = {
  id: string;
  role: AppRole;
  module: string;
  can_view: boolean | null;
  can_create: boolean | null;
  can_edit: boolean | null;
  can_delete: boolean | null;
  can_export: boolean | null;
  company_id: string;
  created_at: string | null;
  updated_at: string | null;
};

interface Employee {
  id: string;
  full_name: string | null;
  email: string;
  roles: AppRole[];
}

export default function Employees() {
  const queryClient = useQueryClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const { hasPermission, currentCompany } = usePermissions();  // Now includes currentCompany

  const availableRoles: { value: AppRole; label: string; color: string; description: string }[] = [
    { 
      value: "admin", 
      label: "Administrador", 
      color: "bg-red-500",
      description: "Acceso total al sistema"
    },
    { 
      value: "manager", 
      label: "Gerente", 
      color: "bg-blue-500",
      description: "Gestión completa excepto configuración crítica"
    },
    { 
      value: "cashier", 
      label: "Cajero", 
      color: "bg-purple-500",
      description: "Ventas y gestión de caja"
    },
    { 
      value: "accountant", 
      label: "Contador", 
      color: "bg-yellow-500",
      description: "Finanzas y reportes"
    },
    { 
      value: "warehouse", 
      label: "Depósito", 
      color: "bg-orange-500",
      description: "Gestión de inventario y compras"
    },
    { 
      value: "technician", 
      label: "Técnico", 
      color: "bg-cyan-500",
      description: "Servicios técnicos y reparaciones"
    },
    { 
      value: "auditor", 
      label: "Auditor", 
      color: "bg-indigo-500",
      description: "Revisión y auditoría (solo lectura)"
    },
    { 
      value: "viewer", 
      label: "Visualizador", 
      color: "bg-gray-500",
      description: "Solo lectura"
    },
    { 
      value: "employee", 
      label: "Empleado", 
      color: "bg-green-500",
      description: "Acceso limitado básico"
    },
  ];

  useEffect(() => {
    fetchEmployees();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      setIsAdmin(roles?.some((r) => r.role === "admin") || false);
    } catch (error: any) {
      console.error("Error checking admin status:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        toast.error("No estás autenticado");
        return;
      }

      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine data (no podemos obtener emails sin service role key)
      const employeesData: Employee[] = profiles?.map((profile) => {
        const roles = (userRoles?.filter((r) => r.user_id === profile.id).map((r) => r.role as AppRole) || []) as AppRole[];

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.id === currentUser.id ? currentUser.email || "Sin email" : "***@***.***",
          roles,
        };
      }) || [];

      setEmployees(employeesData);
    } catch (error: any) {
      toast.error("Error al cargar empleados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (role: AppRole, checked: boolean) => {
    if (checked) {
      setSelectedRoles([...selectedRoles, role]);
    } else {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    }
  };

  const handleUpdateRoles = async () => {
    if (!selectedEmployee) return;

    try {
      // Delete existing roles
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedEmployee.id);

      if (deleteError) throw deleteError;

      // Insert new roles
      if (selectedRoles.length > 0) {
        const rolesToInsert = selectedRoles.map((role) => ({
          user_id: selectedEmployee.id,
          role,
        }));

        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(rolesToInsert);

        if (insertError) throw insertError;
      }

      // Invalidate all permission-related queries to force refetch
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      
      toast.success("Roles actualizados exitosamente");
      setDialogOpen(false);
      fetchEmployees();
    } catch (error: any) {
      toast.error("Error al actualizar roles: " + error.message);
    }
  };

  const openRoleDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSelectedRoles(employee.roles);
    setDialogOpen(true);
  };

  const handleInviteEmployee = async () => {
    if (!inviteEmail) {
      toast.error("El email es requerido");
      return;
    }

    try {
      setInviteLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("No estás autenticado");
        return;
      }

      const response = await fetch(
        `https://pjcfncnydhxrlnaowbae.supabase.co/functions/v1/invite-employee`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: inviteEmail,
            full_name: inviteName,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al invitar empleado");
      }

      toast.success("Invitación enviada exitosamente");
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteName("");
      fetchEmployees();
    } catch (error: any) {
      toast.error("Error al invitar empleado: " + error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    try {
      setResetLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("No estás autenticado");
        return;
      }

      const response = await fetch(
        `https://pjcfncnydhxrlnaowbae.supabase.co/functions/v1/reset-database`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al resetear la base de datos");
      }

      toast.success("Base de datos reseteada exitosamente");
    } catch (error: any) {
      toast.error("Error al resetear la base de datos: " + error.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Add state for permissions management
  const [permissionsData, setPermissionsData] = useState<RolePermission[]>([]);  // Fixed type
  const [editingPermissions, setEditingPermissions] = useState(false);

  // Fetch permissions for the selected employee's roles in the current company
  useEffect(() => {
    if (selectedEmployee && currentCompany?.id) {
      const fetchPermissions = async () => {
        const { data } = await supabase
          .from("role_permissions")
          .select("*")
          .in("role", selectedEmployee.roles || [])  // Assuming roles are fetched as app_role[]
          .eq("company_id", currentCompany.id);
        setPermissionsData(data || []);
      };
      fetchPermissions();
    }
  }, [selectedEmployee, currentCompany]);

  // Function to update permissions
  const updatePermission = async (role: AppRole, module: string, permission: keyof RolePermission, value: boolean) => {
    if (!currentCompany?.id) return;
    const { error } = await supabase
      .from("role_permissions")
      .update({ [permission]: value })
      .eq("role", role)
      .eq("module", module)
      .eq("company_id", currentCompany.id);
    if (!error) {
      // Refresh data
      setPermissionsData(prev => prev.map(p => 
        p.role === role && p.module === module ? { ...p, [permission]: value } : p
      ));
    }
  };

  const filteredEmployees = employees.filter((employee) =>
    employee.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAdmins = employees.filter((e) => e.roles.includes("admin")).length;
  const totalManagers = employees.filter((e) => e.roles.includes("manager")).length;
  const totalCashiers = employees.filter((e) => e.roles.includes("cashier")).length;
  const totalAccountants = employees.filter((e) => e.roles.includes("accountant")).length;
  const totalWarehouse = employees.filter((e) => e.roles.includes("warehouse")).length;
  const totalTechnicians = employees.filter((e) => e.roles.includes("technician")).length;
  const totalAuditors = employees.filter((e) => e.roles.includes("auditor")).length;
  const totalViewers = employees.filter((e) => e.roles.includes("viewer")).length;
  const totalEmployees = employees.filter((e) => e.roles.includes("employee")).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Usuarios</h1>
            <p className="text-muted-foreground mt-1">
              Administra roles y permisos del sistema
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Agregar Empleado
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invitar Nuevo Empleado</DialogTitle>
                      <DialogDescription>
                        Envía una invitación por correo electrónico. El nuevo usuario recibirá un rol de "Empleado" por defecto.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nombre completo (opcional)</Label>
                        <Input
                          id="name"
                          placeholder="Juan Pérez"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="empleado@ejemplo.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleInviteEmployee} disabled={inviteLoading}>
                        {inviteLoading ? "Enviando..." : "Enviar Invitación"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Database className="h-4 w-4 mr-2" />
                      Reset DB
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará todos los datos de ventas, compras, productos, clientes, proveedores y servicios técnicos.
                        Los usuarios y roles permanecerán intactos. Esta acción NO se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetDatabase}
                        disabled={resetLoading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {resetLoading ? "Reseteando..." : "Sí, resetear la base de datos"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAdmins}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gerentes</CardTitle>
              <Shield className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalManagers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cajeros</CardTitle>
              <UserCheck className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCashiers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contadores</CardTitle>
              <UserCheck className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAccountants}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Depósito</CardTitle>
              <UserCheck className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWarehouse}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Técnicos</CardTitle>
              <UserCheck className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTechnicians}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Auditores</CardTitle>
              <UserCheck className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAuditors}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Empleados</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployees}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>ID de Usuario</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No se encontraron empleados
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.full_name || "Sin nombre"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{employee.id.substring(0, 8)}...</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {employee.roles.length === 0 ? (
                            <Badge variant="outline">Sin roles</Badge>
                          ) : (
                            employee.roles.map((role) => {
                              const roleInfo = availableRoles.find((r) => r.value === role);
                              return (
                                <Badge
                                  key={role}
                                  className={`${roleInfo?.color} text-white`}
                                >
                                  {roleInfo?.label || role}
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRoleDialog(employee)}
                        >
                          Gestionar Roles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar Roles y Permisos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing role assignment */}
            <div>
              <Label className="text-sm font-medium">Usuario</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedEmployee?.full_name || "Sin nombre"}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                ID: {selectedEmployee?.id}
              </p>
            </div>

            {/* Roles section (existing) */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Roles asignados</Label>
              {availableRoles.map((role) => (
                <div key={role.value} className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <Checkbox
                    checked={selectedEmployee?.roles?.includes(role.value) || false}
                    onCheckedChange={(checked) => handleRoleChange(role.value, checked as boolean)}
                  />
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{role.label}</Label>
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* New: Permissions management */}
            {hasPermission("employees", "edit") && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-sm font-medium">Permisos por Módulo</Label>
                  <Button variant="outline" size="sm" onClick={() => setEditingPermissions(!editingPermissions)}>
                    {editingPermissions ? "Cancelar" : "Editar Permisos"}
                  </Button>
                </div>
                {permissionsData.map((perm) => (
                  <div key={`${perm.role}-${perm.module}`} className="p-3 rounded-lg border">
                    <Label className="text-sm font-medium">{perm.module} ({perm.role})</Label>
                    <div className="flex space-x-2 mt-2">
                      {["can_view", "can_create", "can_edit", "can_delete", "can_export"].map((p) => (
                        <div key={p} className="flex items-center space-x-1">
                          <Checkbox
                            checked={perm[p as keyof RolePermission] as boolean}
                            disabled={!editingPermissions}
                            onCheckedChange={(checked) => updatePermission(perm.role, perm.module, p as keyof RolePermission, checked as boolean)}  // Fixed call
                          />
                          <Label className="text-xs">{p.replace("can_", "")}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
