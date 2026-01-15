import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Email inválido" }),
  password: z.string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
    .regex(/[A-Z]/, { message: "La contraseña debe contener al menos una mayúscula" })
    .regex(/[a-z]/, { message: "La contraseña debe contener al menos una minúscula" })
    .regex(/[0-9]/, { message: "La contraseña debe contener al menos un número" }),
});

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try { localStorage.setItem("just_signed_in_at", String(Date.now())); } catch {}
        navigate("/app");
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && event === 'INITIAL_SESSION') {
        try { localStorage.setItem("just_signed_in_at", String(Date.now())); } catch {}
        navigate("/app");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      authSchema.parse({ email, password });
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      toast.success("Sesión iniciada correctamente");
      try { localStorage.setItem("just_signed_in_at", String(Date.now())); } catch {}
      navigate("/app");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Error al iniciar sesión");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Signup is now handled via the dedicated wizard route

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!resetEmail.trim()) {
        toast.error("Por favor ingresa tu email");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast.success("¡Correo enviado! Revisa tu email para restablecer tu contraseña.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      toast.error(error.message || "Error al enviar correo de recuperación");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-medium">
        <CardHeader className="space-y-4 text-center relative overflow-hidden group" style={{animation: 'gradientShift 8s infinite ease-in-out'}}>
          {/* Background with gradient animation */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 -z-10"></div>
          
          {/* Blur effects with breathing animation */}
          <div className="absolute inset-0 opacity-50 pointer-events-none">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/15 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="absolute bottom-0 left-0 w-28 h-28 bg-primary/10 rounded-full blur-3xl" style={{animation: 'breathing 6s infinite'}}></div>
          </div>

          {/* Logo container with soft glow and animation */}
          <div className="mx-auto relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-primary/40 shadow-xl shadow-primary/20 backdrop-blur-sm flex items-center justify-center" style={{animation: 'softGlow 4s infinite ease-in-out'}}>
              <img src="/landing/images/logo_transparente_hd.png" alt="Ventify Space" className="w-10 h-10 drop-shadow-lg" />
            </div>
          </div>
          
          <div className="relative z-10">
            <CardTitle className="text-2xl font-bold text-white">Ventify.Space</CardTitle>
            <CardDescription className="text-primary/80 font-medium">Sistema de Punto de Venta</CardDescription>
          </div>

          {/* Custom animations */}
          <style>{`
            @keyframes breathing {
              0%, 100% { opacity: 0.4; transform: scale(1); }
              50% { opacity: 0.6; transform: scale(1.05); }
            }
            @keyframes softGlow {
              0%, 100% { box-shadow: 0 0 20px rgba(var(--primary-rgb, 59, 130, 246), 0.15); }
              50% { box-shadow: 0 0 32px rgba(var(--primary-rgb, 59, 130, 246), 0.25); }
            }
            @keyframes gradientShift {
              0%, 100% { background: linear-gradient(135deg, rgb(15, 23, 42), rgb(30, 41, 59), rgb(15, 23, 42)); }
              50% { background: linear-gradient(135deg, rgb(20, 28, 47), rgb(35, 46, 64), rgb(20, 28, 47)); }
            }
          `}</style>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
            <div className="flex items-center justify-between mt-2">
              <Button
                type="button"
                variant="link"
                className="text-sm text-muted-foreground"
                onClick={() => setShowForgotPassword(true)}
              >
                ¿Olvidaste tu contraseña?
              </Button>
              <Button
                type="button"
                variant="link"
                className="text-sm"
                onClick={() => navigate("/signup")}
              >
                ¿No tienes cuenta? Regístrate
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>

    {/* Forgot Password Dialog */}
    <AlertDialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Recuperar Contraseña</AlertDialogTitle>
          <AlertDialogDescription>
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={handleForgotPassword}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="tu@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmail("");
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar enlace"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}