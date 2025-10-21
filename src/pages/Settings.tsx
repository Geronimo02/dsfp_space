import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Database, Users, Bell } from "lucide-react";

export default function Settings() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configuración</h1>
          <p className="text-muted-foreground">Administra la configuración del sistema</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-soft hover:shadow-medium transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Base de Datos
              </CardTitle>
              <CardDescription>
                Gestión de datos y respaldos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Próximamente: Opciones de respaldo y restauración de datos
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Usuarios y Roles
              </CardTitle>
              <CardDescription>
                Control de acceso y permisos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Próximamente: Gestión de usuarios y roles del sistema
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notificaciones
              </CardTitle>
              <CardDescription>
                Alertas y notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Próximamente: Configuración de alertas de stock bajo y otras notificaciones
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft hover:shadow-medium transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
                General
              </CardTitle>
              <CardDescription>
                Configuración general del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Próximamente: Impuestos, recargos y datos de la empresa
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
