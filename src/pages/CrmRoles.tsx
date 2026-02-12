import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Plus } from "lucide-react";

const CRM_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "team", label: "Team" },
  { value: "manager", label: "Manager" },
];

type CrmRole = "owner" | "team" | "manager";

type CrmRoleScope = "owner" | "team" | "manager";

interface CrmCustomRole {
  id: string;
  name: string;
  scope: CrmRoleScope;
  permissions: {
    can_view?: boolean;
    can_create?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
  };
}

interface CompanyUserRow {
  id: string;
  user_id: string;
  role: string;
  crm_role?: string | null;
  crm_role_id?: string | null;
  active: boolean | null;
  platform_admin: boolean | null;
  profile?: { full_name: string | null } | null;
}

export default function CrmRoles() {
  const { currentCompany } = useCompany();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = isAdmin;
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleScope, setNewRoleScope] = useState<CrmRoleScope>("team");
  const [newRolePermissions, setNewRolePermissions] = useState({
    can_view: true,
    can_create: true,
    can_edit: true,
    can_delete: false,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-basic"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });

  const { data: customRoles = [], isLoading: customRolesLoading } = useQuery({
    queryKey: ["crm-custom-roles", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [] as CrmCustomRole[];
      const { data, error } = await (supabase as any)
        .from("crm_roles")
        .select("id, name, scope, permissions")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as CrmCustomRole[];
    },
    enabled: !!currentCompany?.id && canManage,
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["crm-role-members", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [] as CompanyUserRow[];

      const { data: companyUsers, error } = await (supabase as any)
        .from("company_users")
        .select("id, user_id, role, crm_role, crm_role_id, active, platform_admin")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (!companyUsers?.length) return [] as CompanyUserRow[];

      const userIds = companyUsers.map((cu) => cu.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      return companyUsers.map((cu) => ({
        ...cu,
        profile: profiles?.find((profile) => profile.id === cu.user_id) ?? null,
      })) as CompanyUserRow[];
    },
    enabled: !!currentCompany?.id && canManage,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      if (value.startsWith("custom:")) {
        const roleId = value.replace("custom:", "");
        const { error } = await (supabase as any)
          .from("company_users")
          .update({ crm_role_id: roleId, crm_role: "team" as any })
          .eq("id", id);
        if (error) throw error;
        return;
      }

      const role = value.replace("system:", "") as CrmRole;
      if (!CRM_ROLES.some((r) => r.value === role)) {
        throw new Error("Rol inválido");
      }
      const { error } = await (supabase as any)
        .from("company_users")
        .update({ crm_role: role as any, crm_role_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rol actualizado");
      queryClient.invalidateQueries({ queryKey: ["crm-role-members", currentCompany?.id] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar rol");
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error("Empresa no seleccionada");
      if (!newRoleName.trim()) throw new Error("El nombre es obligatorio");
      const payload = {
        company_id: currentCompany.id,
        name: newRoleName.trim(),
        scope: newRoleScope,
        permissions: newRolePermissions,
      };
      const { error } = await (supabase as any).from("crm_roles").insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rol personalizado creado");
      setIsRoleDialogOpen(false);
      setNewRoleName("");
      setNewRoleScope("team");
      setNewRolePermissions({
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: false,
      });
      queryClient.invalidateQueries({ queryKey: ["crm-custom-roles", currentCompany?.id] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear rol");
    },
  });

  const emptyState = useMemo(() => {
    if (isLoading) return "Cargando usuarios...";
    if (!members.length) return "No hay usuarios para gestionar.";
    return "";
  }, [isLoading, members.length]);

  const emptyRolesState = useMemo(() => {
    if (customRolesLoading) return "Cargando roles personalizados...";
    if (!customRoles.length) return "Todavía no creaste roles personalizados.";
    return "";
  }, [customRolesLoading, customRoles.length]);

  if (!canManage) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Roles CRM</CardTitle>
            <CardDescription>No tenés permisos para administrar roles CRM.</CardDescription>
          </CardHeader>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Roles CRM</h1>
          <p className="text-sm text-muted-foreground">
            Administrá los roles CRM (owner/team/manager) por usuario.
          </p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Precaución con roles personalizados</AlertTitle>
          <AlertDescription>
            Los roles personalizados afectan la visibilidad y acciones en CRM. Configuralos con cuidado para evitar
            bloquear usuarios o exponer datos sensibles.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Usuarios de la empresa</CardTitle>
            <CardDescription>
              Actualizá el rol CRM de cada usuario. Solo admin puede editar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Rol CRM</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {member.profile?.full_name || "Sin nombre"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {currentUser?.id === member.user_id ? "Tu usuario" : "Email no disponible"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {member.user_id}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={
                          (member.crm_role_id
                            ? `custom:${member.crm_role_id}`
                            : `system:${
                                member.crm_role ||
                                (member.role === "manager" || member.role === "admin"
                                  ? "manager"
                                  : member.role === "owner" || member.role === "team"
                                    ? member.role
                                    : "team")
                              }`) as string
                        }
                        disabled={currentUser?.id === member.user_id}
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({
                            id: member.id,
                            value,
                          })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_ROLES.map((role) => (
                            <SelectItem key={role.value} value={`system:${role.value}`}>
                              {role.label}
                            </SelectItem>
                          ))}
                          {customRoles.map((role) => (
                            <SelectItem key={role.id} value={`custom:${role.id}`}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={member.active === false ? "secondary" : "default"}>
                          {member.active === false ? "Inactivo" : "Activo"}
                        </Badge>
                        {member.platform_admin ? <Badge variant="outline">Platform</Badge> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {emptyState && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      {emptyState}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["crm-role-members", currentCompany?.id] })}>
                Recargar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Roles personalizados</CardTitle>
              <CardDescription>
                Creá roles con permisos específicos para CRM.
              </CardDescription>
            </div>
            <Button onClick={() => setIsRoleDialogOpen(true)} className="sm:w-auto w-full">
              <Plus className="h-4 w-4 mr-2" />
              Crear rol
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Permisos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {role.scope === "owner"
                        ? "Solo asignadas"
                        : role.scope === "team"
                          ? "Toda la empresa"
                          : "Acceso total"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {(role.permissions?.can_view ?? true) && <Badge variant="secondary">Ver</Badge>}
                        {role.permissions?.can_create && <Badge variant="secondary">Crear</Badge>}
                        {role.permissions?.can_edit && <Badge variant="secondary">Editar</Badge>}
                        {role.permissions?.can_delete && <Badge variant="destructive">Eliminar</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {emptyRolesState && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      {emptyRolesState}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear rol personalizado</DialogTitle>
            <DialogDescription>
              Definí un rol con permisos específicos para CRM. Usá con cuidado para evitar bloqueos de acceso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Nombre del rol</Label>
              <Input
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder="Ej: Supervisor comercial"
              />
            </div>

            <div className="space-y-2">
              <Label>Alcance de visibilidad</Label>
              <Select value={newRoleScope} onValueChange={(value) => setNewRoleScope(value as CrmRoleScope)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar alcance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Solo oportunidades asignadas</SelectItem>
                  <SelectItem value="team">Oportunidades de toda la empresa</SelectItem>
                  <SelectItem value="manager">Acceso total (manager)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label>Permisos</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">Ver CRM</p>
                    <p className="text-xs text-muted-foreground">Permite acceder a oportunidades.</p>
                  </div>
                  <Switch
                    checked={newRolePermissions.can_view}
                    onCheckedChange={(checked) =>
                      setNewRolePermissions((prev) => ({ ...prev, can_view: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">Crear oportunidades</p>
                    <p className="text-xs text-muted-foreground">Permite cargar nuevas oportunidades.</p>
                  </div>
                  <Switch
                    checked={newRolePermissions.can_create}
                    onCheckedChange={(checked) =>
                      setNewRolePermissions((prev) => ({ ...prev, can_create: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">Editar oportunidades</p>
                    <p className="text-xs text-muted-foreground">Permite actualizar datos y etapas.</p>
                  </div>
                  <Switch
                    checked={newRolePermissions.can_edit}
                    onCheckedChange={(checked) =>
                      setNewRolePermissions((prev) => ({ ...prev, can_edit: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">Eliminar oportunidades</p>
                    <p className="text-xs text-muted-foreground">Acción irreversible.</p>
                  </div>
                  <Switch
                    checked={newRolePermissions.can_delete}
                    onCheckedChange={(checked) =>
                      setNewRolePermissions((prev) => ({ ...prev, can_delete: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createRoleMutation.mutate()} disabled={createRoleMutation.isPending}>
              Crear rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
