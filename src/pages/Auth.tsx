import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ShoppingCart, Building2 } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Email inválido" }),
  password: z.string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres" })
    .regex(/[A-Z]/, { message: "La contraseña debe contener al menos una mayúscula" })
    .regex(/[a-z]/, { message: "La contraseña debe contener al menos una minúscula" })
    .regex(/[0-9]/, { message: "La contraseña debe contener al menos un número" }),
  fullName: z.string().trim().min(1, { message: "El nombre es requerido" }).optional(),
});

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user has companies
        const { data: companies } = await supabase
          .from('company_users')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('active', true);
        
        // Si tiene empresas, ir directo al dashboard
        // Si no tiene, ir a crear empresa
        if (companies && companies.length > 0) {
          navigate("/");
        } else {
          navigate("/company-setup");
        }
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && event === 'SIGNED_IN') {
        // Check if user has companies
        const { data: companies } = await supabase
          .from('company_users')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('active', true);
        
        if (companies && companies.length > 0) {
          navigate("/");
        } else {
          navigate("/company-setup");
        }
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
      
      // No need to toast or navigate here, auth state change will handle it
      console.log("Login successful");
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      authSchema.parse({ email, password, fullName });
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      
      // Check if user already has companies (invited user)
      if (data.user) {
        const { data: companies } = await supabase
          .from('company_users')
          .select('id')
          .eq('user_id', data.user.id)
          .eq('active', true);

        if (companies && companies.length > 0) {
          // Usuario invitado que ya tiene empresa asignada
          toast.success("¡Bienvenido! Redirigiendo a tu empresa...");
          navigate("/");
        } else {
          // Usuario nuevo sin empresa
          setShowWelcomeModal(true);
        }
      } else {
        toast.success("¡Cuenta creada! Revisa tu email para confirmar tu cuenta.");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Error al crear cuenta");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleWelcomeComplete = () => {
    setShowWelcomeModal(false);
    navigate("/company-setup");
  };

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
      <AlertDialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <AlertDialogTitle className="text-2xl text-center">
              ¡Bienvenido a RetailSnap Pro!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-2">
              <p className="text-base">
                Tu cuenta ha sido creada exitosamente.
              </p>
              <p className="text-base">
                Ahora necesitas configurar tu empresa para comenzar a usar el sistema.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleWelcomeComplete} className="w-full">
              Configurar mi empresa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-medium">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-soft">
            <ShoppingCart className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">RetailSnap Pro</CardTitle>
            <CardDescription>Sistema de Punto de Venta</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
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
                <div className="text-center mt-2">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-muted-foreground"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    ¿Olvidaste tu contraseña?
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nombre Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Tu nombre"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Contraseña</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
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
