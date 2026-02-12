import { useMemo } from "react";
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
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CRM_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "team", label: "Team" },
  { value: "manager", label: "Manager" },
];

type CrmRole = "owner" | "team" | "manager";

interface CompanyUserRow {
  id: string;
  user_id: string;
  role: string;
  crm_role?: string | null;
  active: boolean | null;
  platform_admin: boolean | null;
  profile?: { full_name: string | null } | null;
}

export default function CrmRoles() {
  const { currentCompany } = useCompany();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const canManage = isAdmin;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["crm-role-members", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [] as CompanyUserRow[];

      const { data: companyUsers, error } = await supabase
        .from("company_users")
        .select("id, user_id, role, crm_role, active, platform_admin")
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
    mutationFn: async ({ id, role }: { id: string; role: CrmRole }) => {
      if (!CRM_ROLES.some((r) => r.value === role)) {
        throw new Error("Rol inválido");
      }
      const { error } = await supabase
        .from("company_users")
        .update({ crm_role: role as any })
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

  const emptyState = useMemo(() => {
    if (isLoading) return "Cargando usuarios...";
    if (!members.length) return "No hay usuarios para gestionar.";
    return "";
  }, [isLoading, members.length]);

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
                          Email no disponible
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {member.user_id}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={
                          (member.crm_role ||
                            (member.role === "manager" || member.role === "admin"
                              ? "manager"
                              : member.role === "owner" || member.role === "team"
                                ? member.role
                                : "team")) as string
                        }
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({
                            id: member.id,
                            role: value as CrmRole,
                          })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
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
      </div>
    </Layout>
  );
}
