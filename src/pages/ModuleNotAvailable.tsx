import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft, Mail, Phone } from "lucide-react";

export default function ModuleNotAvailable() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Lock className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl">Módulo No Disponible</CardTitle>
          <CardDescription className="text-base">
            Este módulo no está incluido en tu plan actual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-6 bg-muted rounded-lg space-y-4">
            <p className="text-center text-muted-foreground">
              Para acceder a este módulo y ampliar las funcionalidades de tu sistema,
              contactá con nuestro equipo para actualizar tu suscripción.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-3 p-4 bg-background rounded-lg border">
                <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground truncate">soporte@retailsnap.com</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-background rounded-lg border">
                <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Teléfono</p>
                  <p className="text-sm text-muted-foreground">+54 11 1234-5678</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-3">Beneficios de actualizar tu plan:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Acceso a módulos adicionales según tus necesidades</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Mayor capacidad para gestionar tu negocio</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Automatización de procesos avanzados</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Soporte prioritario y actualizaciones continuas</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <Button
              className="flex-1"
              onClick={() => navigate("/")}
            >
              Ir al Dashboard
            </Button>
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-muted-foreground">
              ¿Necesitás ayuda? Contactanos y te asesoramos sobre el plan ideal para tu negocio
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
