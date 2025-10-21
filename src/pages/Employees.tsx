import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { UserPlus, Search, Users, Shield, UserCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type AppRole = "admin" | "manager" | "employee";

interface Employee {
  id: string;
  full_name: string | null;
  email: string;
  roles: AppRole[];
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);

  const availableRoles: { value: AppRole; label: string; color: string }[] = [
    { value: "admin", label: "Administrador", color: "bg-red-500" },
    { value: "manager", label: "Gerente", color: "bg-blue-500" },
    { value: "employee", label: "Empleado", color: "bg-green-500" },
  ];

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);

      // Get all users from auth.users via profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name");

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get emails from auth admin API
      const { data, error: usersError } = await supabase.auth.admin.listUsers();

      if (usersError) throw usersError;

      const users = data?.users || [];

      // Combine data
      const employeesData: Employee[] = profiles?.map((profile) => {
        const user = users.find((u) => u.id === profile.id);
        const roles = (userRoles?.filter((r) => r.user_id === profile.id).map((r) => r.role as AppRole) || []) as AppRole[];

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: user?.email || "Sin email",
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

  const filteredEmployees = employees.filter((employee) =>
    employee.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAdmins = employees.filter((e) => e.roles.includes("admin")).length;
  const totalManagers = employees.filter((e) => e.roles.includes("manager")).length;
  const totalEmployees = employees.filter((e) => e.roles.includes("employee")).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Empleados</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona usuarios y permisos del sistema
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Empleados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
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
                  <TableHead>Email</TableHead>
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
                      <TableCell>{employee.email}</TableCell>
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
            <DialogTitle>Gestionar Roles</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Usuario</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedEmployee?.full_name || "Sin nombre"} ({selectedEmployee?.email})
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Roles asignados</Label>
              {availableRoles.map((role) => (
                <div key={role.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={role.value}
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={(checked) => handleRoleChange(role.value, checked as boolean)}
                  />
                  <label
                    htmlFor={role.value}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    <Badge className={`${role.color} text-white`}>{role.label}</Badge>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateRoles}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
