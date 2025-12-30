import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function SignupCancel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const intentId = searchParams.get("intent_id");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">Pago cancelado</CardTitle>
          <CardDescription className="text-center">
            Has cancelado el proceso de pago
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <XCircle className="w-16 h-16 text-amber-500" />
          </div>

          <div className="space-y-4">
            <p className="text-sm text-center">
              No se ha procesado ningún cargo. Puedes volver al registro y completar tu suscripción
              cuando estés listo.
            </p>

            {intentId && (
              <p className="text-xs text-center text-muted-foreground">ID: {intentId}</p>
            )}

            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate("/signup")} className="w-full">
                Volver al registro
              </Button>
              <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                Ir al login
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
