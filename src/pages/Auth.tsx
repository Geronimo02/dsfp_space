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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
        {/* Advanced animated background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {/* Main breathing orbs */}
          <div className="absolute top-1/4 -right-48 w-96 h-96 bg-primary/10 rounded-full blur-3xl" style={{animation: 'breathing 8s infinite'}}></div>
          <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-primary/5 rounded-full blur-3xl" style={{animation: 'breathing 10s infinite 2s'}}></div>
          
          {/* Floating particles */}
          <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl" style={{animation: 'float 12s infinite ease-in-out'}}></div>
          <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl" style={{animation: 'float 15s infinite ease-in-out 3s'}}></div>
          <div className="absolute top-2/3 left-1/3 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" style={{animation: 'float 10s infinite ease-in-out 5s'}}></div>
          
          {/* Rotating gradient overlay */}
          <div className="absolute inset-0 opacity-30" style={{animation: 'rotateGradient 20s infinite linear'}}>
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-cyan-500/5"></div>
          </div>
          
          {/* Pulsing rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/5 rounded-full" style={{animation: 'pulse 8s infinite ease-in-out'}}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-cyan-500/5 rounded-full" style={{animation: 'pulse 12s infinite ease-in-out 2s'}}></div>
        </div>

        <Card
          className="w-full max-w-3xl shadow-[0_28px_80px_rgba(0,0,0,0.55)] border-primary/40 relative z-10 bg-gradient-to-br from-slate-800/90 via-slate-700/90 to-slate-800/90 backdrop-blur-2xl p-6 md:p-8"
          style={{animation: 'fadeInUp 0.6s ease-out'}}
        >
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <CardHeader className="pb-6 md:pb-8 flex flex-col items-center justify-center gap-6 text-center">
          {/* Logo with elegant animation */}
          <div className="relative flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 via-transparent to-cyan-500/10 border border-primary/30 flex items-center justify-center overflow-visible" style={{animation: 'softGlow 4s infinite ease-in-out'}}>
              <div className="absolute inset-2 rounded-full border border-white/10"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/12 to-transparent opacity-80" style={{animation: 'shine 3s infinite'}}></div>
              <img src="/landing/images/logo_transparente_hd.png" alt="Ventify Space" className="w-12 h-12 relative z-10 drop-shadow-[0_8px_18px_rgba(59,130,246,0.45)]" />
            </div>
          </div>


          {/* Custom animations */}
          <style>{`
            @keyframes breathing {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(1.1); }
            }
            @keyframes softGlow {
              0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.2), 0 0 40px rgba(59, 130, 246, 0.1); }
              50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.15); }
            }
            @keyframes shine {
              0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
              100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
            }
            @keyframes float {
              0%, 100% { transform: translate(0, 0) rotate(0deg); }
              25% { transform: translate(20px, -30px) rotate(5deg); }
              50% { transform: translate(-15px, -50px) rotate(-5deg); }
              75% { transform: translate(-25px, -25px) rotate(3deg); }
            }
            @keyframes rotateGradient {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
              50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.5; }
            }
          `}</style>
        </CardHeader>
        <CardContent className="pt-2 md:pt-4">
          <form onSubmit={handleLogin} className="space-y-5 md:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-white font-medium">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-900/50 border-primary/30 text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-white font-medium">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-900/50 border-primary/30 text-white placeholder:text-slate-400 focus:border-primary focus:ring-primary/20"
              />
            </div>
            <Button type="submit" className="w-full mt-2 h-11 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
            <div className="flex items-center justify-between mt-4 pt-2 border-t border-primary/30">
              <Button
                type="button"
                variant="link"
                className="text-sm text-slate-300 hover:text-white"
                onClick={() => setShowForgotPassword(true)}
              >
                ¿Olvidaste tu contraseña?
              </Button>
              <Button
                type="button"
                variant="link"
                className="text-sm text-primary hover:text-primary/80 font-medium"
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
              <Label htmlFor="reset-email" className="text-foreground font-medium">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="tu@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="border-primary/30 focus:border-primary focus:ring-primary/20"
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