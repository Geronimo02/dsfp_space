import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Users, Plus, Edit, Trash2, Shield, UserCog, Mail, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { EmployeePermissionsManager } from "@/components/employees/EmployeePermissionsManager";
import { EmployeeRoleAssignment } from "@/components/employees/EmployeeRoleAssignment";

interface EmployeeFormData {
  first_name: string;
  last_name: string;
  document_type: string;
  document_number: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  hire_date: string;
  base_salary: number;
  salary_type: string;
}

const initialFormData: EmployeeFormData = {
  first_name: "",
  last_name: "",
  document_type: "DNI",
  document_number: "",
  email: "",
  phone: "",
  position: "",
  department: "",
  hire_date: new Date().toISOString().split("T")[0],
  base_salary: 0,
  salary_type: "monthly",
};

const Employees = () => {
  const { currentCompany } = useCompany();
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"employee" | "manager">("employee");

  const canCreate = hasPermission("employees", "create");
  const canEdit = hasPermission("employees", "edit");
  const canDelete = hasPermission("employees", "delete");

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Obtener empleados de la tabla employees
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      
      if (employeesError) throw employeesError;

      // No necesitamos verificar company_users en el cliente
      // El badge se agregará desde el servidor cuando implementemos RPC
      return employeesData || [];
    },
    enabled: !!currentCompany?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      if (!currentCompany?.id) throw new Error("No hay empresa seleccionada");
      
      const { error } = await supabase
        .from("employees")
        .insert({
          ...data,
          company_id: currentCompany.id,
          active: true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Empleado creado exitosamente");
      setDialogOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: any) => {
      toast.error("Error al crear empleado: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmployeeFormData> }) => {
      const { error } = await supabase
        .from("employees")
        .update(data)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Empleado actualizado exitosamente");
      setDialogOpen(false);
      setEditingEmployee(null);
      setFormData(initialFormData);
    },
    onError: (error: any) => {
      toast.error("Error al actualizar empleado: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Empleado eliminado exitosamente");
    },
    onError: () => {
      toast.error("Error al eliminar el empleado");
    },
  });

  // Nueva mutación para invitar empleado y crear acceso
  const inviteEmployeeMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string, role: string }) => {
      if (!currentCompany?.id) throw new Error("No hay empresa seleccionada");
      
      // Llamar a la edge function para invitar al empleado
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión activa");

      const response = await supabase.functions.invoke('invite-employee', {
        body: {
          email,
          role,
          companyId: currentCompany.id,
          full_name: email.split("@")[0], // Nombre temporal
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Error al invitar empleado");
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Invitación enviada exitosamente. El empleado recibirá un email para configurar su contraseña.");
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("employee");
    },
    onError: (error: any) => {
      console.error("Error al invitar empleado:", error);
      toast.error("Error al invitar empleado: " + (error.message || "Error desconocido"));
    },
  });

  const handleSubmit = () => {
    if (!formData.first_name || !formData.last_name) {
      toast.error("Nombre y apellido son requeridos");
      return;
    }
    if (!formData.hire_date) {
      toast.error("Fecha de ingreso es requerida");
      return;
    }

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (employee: any) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      document_type: employee.document_type || "DNI",
      document_number: employee.document_number || "",
      email: employee.email || "",
      phone: employee.phone || "",
      position: employee.position || "",
      department: employee.department || "",
      hire_date: employee.hire_date || "",
      base_salary: employee.base_salary || 0,
      salary_type: employee.salary_type || "monthly",
    });
    setDialogOpen(true);
  };

  const handleOpenDialog = () => {
    setEditingEmployee(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Empleados</h1>
            </div>
          </div>
          <div className="animate-pulse bg-muted h-96 rounded-lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-4 md:mb-6">
          <Users className="h-6 w-6 md:h-8 md:w-8" />
          <h1 className="text-2xl md:text-3xl font-bold">Empleados</h1>
        </div>

        <Tabs defaultValue="list" className="space-y-4 md:space-y-6">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="list" className="flex-1 min-w-[100px] text-xs sm:text-sm">
              <Users className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="roles" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                  <UserCog className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Roles</span>
                </TabsTrigger>
                <TabsTrigger value="permissions" className="flex-1 min-w-[80px] text-xs sm:text-sm">
                  <Shield className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Permisos</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="list">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Gestión de Empleados</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Administra la información de tus empleados
                    </CardDescription>
                  </div>
                  {canCreate && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full sm:w-auto">
                            <Mail className="mr-2 h-4 w-4" />
                            <span className="sm:inline">Invitar por Email</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invitar Empleado</DialogTitle>
                            <DialogDescription>
                              El empleado recibirá un email para crear su cuenta y acceder al sistema.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="invite-email">Email</Label>
                              <Input
                                id="invite-email"
                                type="email"
                                placeholder="empleado@empresa.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="invite-role">Rol</Label>
                              <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                                <SelectTrigger id="invite-role">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="employee">Empleado</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  if (!inviteEmail) {
                                    toast.error("Ingresa un email");
                                    return;
                                  }
                                  inviteEmployeeMutation.mutate({ email: inviteEmail, role: inviteRole });
                                }}
                                disabled={inviteEmployeeMutation.isPending}
                                className="flex-1"
                              >
                                {inviteEmployeeMutation.isPending ? "Enviando..." : "Enviar Invitación"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setInviteDialogOpen(false);
                                  setInviteEmail("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                          <Button onClick={handleOpenDialog} size="sm" className="w-full sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" />
                            <span className="sm:inline">Nuevo Empleado</span>
                          </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            {editingEmployee ? "Editar Empleado" : "Nuevo Empleado"}
                          </DialogTitle>
                          <DialogDescription>
                            {editingEmployee 
                              ? "Modifica los datos del empleado"
                              : "Completa los datos del nuevo empleado"
                            }
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="first_name">Nombre *</Label>
                            <Input
                              id="first_name"
                              value={formData.first_name}
                              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                              placeholder="Juan"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="last_name">Apellido *</Label>
                            <Input
                              id="last_name"
                              value={formData.last_name}
                              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                              placeholder="Pérez"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="document_type">Tipo Documento</Label>
                            <Select 
                              value={formData.document_type} 
                              onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DNI">DNI</SelectItem>
                                <SelectItem value="CUIL">CUIL</SelectItem>
                                <SelectItem value="CUIT">CUIT</SelectItem>
                                <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="document_number">Número Documento</Label>
                            <Input
                              id="document_number"
                              value={formData.document_number}
                              onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                              placeholder="12345678"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                              placeholder="juan@empresa.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input
                              id="phone"
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              placeholder="+54 11 1234-5678"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="position">Cargo</Label>
                            <Input
                              id="position"
                              value={formData.position}
                              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                              placeholder="Vendedor"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="department">Departamento</Label>
                            <Input
                              id="department"
                              value={formData.department}
                              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                              placeholder="Ventas"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hire_date">Fecha de Ingreso *</Label>
                            <Input
                              id="hire_date"
                              type="date"
                              value={formData.hire_date}
                              onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="salary_type">Tipo de Salario</Label>
                            <Select 
                              value={formData.salary_type} 
                              onValueChange={(value) => setFormData({ ...formData, salary_type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monthly">Mensual</SelectItem>
                                <SelectItem value="hourly">Por hora</SelectItem>
                                <SelectItem value="daily">Diario</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label htmlFor="base_salary">Salario Base</Label>
                            <Input
                              id="base_salary"
                              type="number"
                              value={formData.base_salary || ""}
                              onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || 0 })}
                              placeholder="100000"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleSubmit} 
                            disabled={createMutation.isPending || updateMutation.isPending}
                          >
                            {createMutation.isPending || updateMutation.isPending 
                              ? "Guardando..." 
                              : editingEmployee ? "Actualizar" : "Crear Empleado"
                            }
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-2 sm:p-6">
                {employees && employees.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Nombre</TableHead>
                        <TableHead className="hidden sm:table-cell">Documento</TableHead>
                        <TableHead className="hidden md:table-cell">Posición</TableHead>
                        <TableHead className="hidden lg:table-cell">Departamento</TableHead>
                        <TableHead className="hidden lg:table-cell">Ingreso</TableHead>
                        <TableHead className="hidden md:table-cell">Salario</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <span>{employee.first_name} {employee.last_name}</span>
                              {employee.email && (
                                <span className="text-xs text-muted-foreground">{employee.email}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs sm:text-sm">
                            {employee.document_type} {employee.document_number}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs sm:text-sm">{employee.position || "-"}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs sm:text-sm">{employee.department || "-"}</TableCell>
                          <TableCell className="hidden lg:table-cell text-xs sm:text-sm">
                            {employee.hire_date
                              ? format(new Date(employee.hire_date), "dd/MM/yyyy", { locale: es })
                              : "-"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs sm:text-sm">${employee.base_salary?.toLocaleString() || 0}</TableCell>
                          <TableCell>
                            <Badge variant={employee.active ? "default" : "secondary"}>
                              {employee.active ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {canEdit && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEdit(employee)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm("¿Está seguro de eliminar este empleado?")) {
                                      deleteMutation.mutate(employee.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay empleados registrados</h3>
                    <p className="text-muted-foreground mb-4">
                      Comienza agregando el primer empleado a tu empresa
                    </p>
                    {canCreate && (
                      <Button onClick={handleOpenDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar Primer Empleado
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <>
              <TabsContent value="roles">
                <EmployeeRoleAssignment />
              </TabsContent>

              <TabsContent value="permissions">
                <EmployeePermissionsManager />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </Layout>
  );
};

export default Employees;