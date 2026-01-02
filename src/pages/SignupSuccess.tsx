import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SignupSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Get intent_id from URL or localStorage
  const intentFromUrl = searchParams.get("intent_id");
  const intentFromStorage = typeof window !== "undefined" ? localStorage.getItem("signup_intent_id") : null;
  const intentId = intentFromUrl || intentFromStorage;

  const [status, setStatus] = useState<"checking" | "checkout_created" | "finalizing" | "paid_ready" | "timeout" | "error">("checking");
  const [attempts, setAttempts] = useState(0);
  const [password, setPassword] = useState("");
  const [passwordLoaded, setPasswordLoaded] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // Try to get password from localStorage
    const savedData = localStorage.getItem("signup_wizard_data");
    console.log("[SignupSuccess] Loading saved data:", savedData);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        console.log("[SignupSuccess] Parsed data:", { email: data.email, hasPassword: !!data.password });
        setPassword(data.password);
        setPasswordLoaded(true);
      } catch (e) {
        console.error("[SignupSuccess] Error loading password:", e);
        setPasswordLoaded(true); // Mark as loaded even if error
      }
    } else {
      console.warn("[SignupSuccess] No saved wizard data found");
      setPasswordLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!intentId) {
      setStatus("error");
      return;
    }

    // Don't start checking until password is loaded
    if (!passwordLoaded) {
      console.log("[SignupSuccess] Waiting for password to load...");
      return;
    }

    const checkStatus = async () => {
      try {
        // Use edge function to check status (avoids RLS issues with unauthenticated users)
        const { data, error } = await supabase.functions.invoke("get-intent-status", {
          body: { intent_id: intentId },
        });

        if (error) throw error;

        console.log("[SignupSuccess] Intent status:", data.status);

        if (data.status === "paid_ready") {
          setStatus("paid_ready");
          // Automatically finalize signup
          await finalizeSignup();
        } else if (data.status === "checkout_created") {
          setStatus("checkout_created");
          // Confirm intent ready (after returning from checkout)
          const stripeSessionId = searchParams.get("session_id") || null;
          try {
            const { data: readyData, error: readyErr } = await supabase.functions.invoke("mark-intent-ready", {
              body: { intent_id: intentId, stripe_session_id: stripeSessionId },
            });
            if (readyErr) throw readyErr;
            console.log("[SignupSuccess] Marked intent ready:", readyData);
            // Re-check status to proceed to finalize
            setStatus("checking");
            setAttempts((prev) => prev + 1);
          } catch (e) {
            console.error("[SignupSuccess] Error marking intent ready:", e);
            setStatus("error");
          }
        } else if (attempts >= 30) {
          // 30 attempts * 2s = 60s
          setStatus("timeout");
        }
      } catch (error) {
        console.error("[SignupSuccess] Error checking status:", error);
        setStatus("error");
      }
    };

    if (status === "checking") {
      const interval = setInterval(() => {
        setAttempts((prev) => prev + 1);
        checkStatus();
      }, 2000);

      // Initial check
      checkStatus();

      return () => clearInterval(interval);
    }
  }, [intentId, status, attempts, passwordLoaded]);

  const finalizeSignup = async () => {
    if (!intentId || !password) {
      console.error("[SignupSuccess] Missing data:", { intentId, hasPassword: !!password });
      toast.error("Faltan datos para finalizar el registro");
      setStatus("error");
      return;
    }

    try {
      setStatus("finalizing");
      console.log("[SignupSuccess] Finalizing signup with intent_id:", intentId);

      const { data, error } = await supabase.functions.invoke("finalize-signup", {
        body: {
          intent_id: intentId,
          password: password,
        },
      });

        if (error) {
          console.error("[SignupSuccess] finalize-signup error:", error, "data:", data);
          // Try to extract error from different possible locations
          let errorMsg = "Error desconocido al procesar el pago";
          
          if (data?.error) {
            errorMsg = data.error;
          } else if ((error as any)?.context?.response) {
            const responseText = (error as any).context.response;
            try {
              const parsed = typeof responseText === "string" ? JSON.parse(responseText) : responseText;
              errorMsg = parsed.error || parsed.message || errorMsg;
            } catch (e) {
              errorMsg = (error as any)?.message || errorMsg;
            }
          } else if ((error as any)?.message) {
            // Don't use generic "Edge Function" error, try to extract real error
            const msg = (error as any).message;
            if (!msg.includes("non-2xx")) {
              errorMsg = msg;
            }
          }
          
          setErrorMessage(errorMsg);
          throw new Error(errorMsg);
        }

        if (data?.error) {
          console.error("[SignupSuccess] finalize-signup returned error:", data.error);
          setErrorMessage(data.error);
          throw new Error(data.error);
        }

      console.log("[SignupSuccess] Signup finalized:", data);
      setStatus("paid_ready");

      // Clear localStorage
      localStorage.removeItem("signup_wizard_data");
      localStorage.removeItem("signup_intent_id");

      toast.success("¡Cuenta creada exitosamente!");

      // Wait a bit longer to ensure company_users entry is committed
      // Then reload to pick up new company in CompanyContext
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify company was created before reloading
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: companies } = await supabase
            .from('company_users')
            .select('id')
            .eq('user_id', user.id)
            .limit(1);
          
          if (companies && companies.length > 0) {
            console.log("[SignupSuccess] Company verified, reloading...");
          } else {
            console.warn("[SignupSuccess] Company not found yet, but reloading anyway...");
          }
        }
      } catch (e) {
        console.warn("[SignupSuccess] Could not verify company:", e);
      }

      window.location.href = "/";
    } catch (error) {
      console.error("[SignupSuccess] Error finalizing:", error);
        const errorMsg = errorMessage || (error instanceof Error ? error.message : String(error));
        toast.error(errorMsg);
      setStatus("error");
    }
  };

  const handleRetry = () => {
    setStatus("checking");
    setAttempts(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-center">
            {(status === "checking" || status === "finalizing") && "Verificando pago..."}
            {status === "checkout_created" && "Guardando método de pago..."}
            {status === "paid_ready" && "¡Pago verificado!"}
            {status === "timeout" && "Verificación en curso"}
            {status === "error" && "Error"}
          </CardTitle>
          <CardDescription className="text-center">
            {(status === "checking" || status === "finalizing") && "Estamos confirmando tu pago. Por favor espera..."}
            {status === "checkout_created" && "Procesando autorización para cobros automáticos"}
            {status === "paid_ready" && "Pago verificado. Configurando tu empresa"}
            {status === "timeout" && "El proceso está tomando más tiempo del esperado"}
            {status === "error" && "Ocurrió un error al verificar el pago"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            {status === "checking" && <Loader2 className="w-16 h-16 animate-spin text-primary" />}
            {status === "paid_ready" && <CheckCircle2 className="w-16 h-16 text-green-500" />}
            {status === "timeout" && <Clock className="w-16 h-16 text-amber-500" />}
            {status === "error" && <XCircle className="w-16 h-16 text-destructive" />}
          </div>

          {status === "checking" && (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Tiempo transcurrido: {attempts * 2} segundos
              </p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(attempts / 30) * 100}%` }}
                />
              </div>
            </div>
          )}

          {status === "timeout" && (
            <div className="space-y-4">
              <p className="text-sm text-center">
                El pago puede estar siendo procesado. Puedes intentar refrescar la página o contactar
                soporte.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleRetry} className="flex-1">
                  Reintentar
                </Button>
                <Button variant="outline" onClick={() => navigate("/auth")} className="flex-1">
                  Ir a login
                </Button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription className="space-y-2">
                    <p className="font-semibold">Error al procesar el pago</p>
                    <p className="text-sm">{errorMessage || "No pudimos procesar tu pago."}</p>
                    {intentId && (
                      <p className="text-xs text-muted-foreground">ID de referencia: {intentId}</p>
                    )}
                  </AlertDescription>
                </Alert>
              <Button onClick={() => navigate("/signup")} className="w-full">
                Volver al registro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
