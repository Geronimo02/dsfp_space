import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function SetPasswordToken() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error("Token inválido");
    if (password.length < 8) return toast.error("La contraseña debe tener al menos 8 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || ""}/consume-invite-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error");
      toast.success("Contraseña guardada. Ya puedes iniciar sesión.");
      setTimeout(() => navigate("/auth"), 1200);
    } catch (err: any) {
      toast.error(err.message || "Error procesando el token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configurar contraseña</CardTitle>
          <CardDescription>Ingrese su nueva contraseña para finalizar la invitación</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nueva contraseña</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label>Confirmar contraseña</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>{loading ? "Procesando..." : "Guardar contraseña"}</Button>
              <Button variant="ghost" onClick={() => navigate("/auth")}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
