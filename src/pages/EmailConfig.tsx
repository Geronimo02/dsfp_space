import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export default function EmailConfig() {
  const [loading, setLoading] = useState(false);
  const { data: config, isLoading } = useQuery({
    queryKey: ["smtp-config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-smtp-config", {});
      if (error) throw error;
      return data?.smtp ?? null;
    },
  });

  const [form, setForm] = useState({
    provider: "smtp",
    host: "",
    port: 587,
    user: "",
    password: "",
    from: "",
    secure: false,
    apiKey: "",
  });

  useEffect(() => {
    if (config) {
      setForm((f) => ({ ...f, ...config }));
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.functions.invoke("save-smtp-config", { body: { smtp: payload } });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      toast.success("Configuración guardada");
    },
    onError: (err: any) => {
      toast.error(err.message || "Error guardando configuración");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveMutation.mutateAsync(form);
    } catch (err) {
      // handled by onError
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Configuración de correo</CardTitle>
            <CardDescription>Configura el proveedor de email para enviar invitaciones y notificaciones.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Proveedor</Label>
                <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="mt-1 p-2 border rounded w-full">
                  <option value="smtp">SMTP</option>
                  <option value="sendgrid">SendGrid (API)</option>
                </select>
              </div>

              {form.provider === "smtp" && (
                <>
                  <div>
                    <Label>Host</Label>
                    <Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <Input type="number" value={String(form.port)} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>User</Label>
                    <Input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
                  </div>
                  <div>
                    <Label>Password</Label>
                    <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div>
                    <Label>From address</Label>
                    <Input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.secure} onCheckedChange={(v: any) => setForm({ ...form, secure: !!v })} />
                    <Label>Use TLS/SSL</Label>
                  </div>
                </>
              )}

              {form.provider === "sendgrid" && (
                <>
                  <div>
                    <Label>API Key</Label>
                    <Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
                  </div>
                  <div>
                    <Label>From address</Label>
                    <Input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                  </div>
                </>
              )}

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar configuración"}</Button>
                <Button variant="ghost" onClick={() => setForm({ provider: "smtp", host: "", port: 587, user: "", password: "", from: "", secure: false, apiKey: "" })}>Limpiar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
