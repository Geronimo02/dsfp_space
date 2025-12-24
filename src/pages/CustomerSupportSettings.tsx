import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { Mail, MessageSquare, Phone, Save, Clock, FileText } from "lucide-react";
import { ResponseTemplatesManager } from "@/components/support/ResponseTemplatesManager";
import { SLASettingsManager } from "@/components/support/SLASettingsManager";

export default function CustomerSupportSettings() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  // Fetch integrations
  const { data: integrations } = useQuery({
    queryKey: ["support-integrations", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await (supabase as any)
        .from("customer_support_integrations")
        .select("*")
        .eq("company_id", currentCompany.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Email configuration
  const [emailConfig, setEmailConfig] = useState({
    is_active: false,
    send_on_ticket_created: true,
    send_on_message_received: true,
    send_on_status_changed: true,
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_password: "",
    from_email: "",
    from_name: "",
  });

  // Twilio SMS configuration
  const [twilioSMSConfig, setTwilioSMSConfig] = useState({
    is_active: false,
    send_on_ticket_created: false,
    send_on_message_received: true,
    send_on_status_changed: true,
    account_sid: "",
    auth_token: "",
    phone_number: "",
  });

  // WhatsApp configuration
  const [whatsappConfig, setWhatsappConfig] = useState({
    is_active: false,
    send_on_ticket_created: false,
    send_on_message_received: true,
    send_on_status_changed: false,
    account_sid: "",
    auth_token: "",
    whatsapp_number: "",
  });

  // Save integration mutation
  const saveIntegrationMutation = useMutation({
    mutationFn: async ({ type, config }: { type: string; config: any }) => {
      if (!currentCompany?.id) throw new Error("No company selected");

      const { error } = await (supabase as any)
        .from("customer_support_integrations")
        .upsert({
          company_id: currentCompany.id,
          integration_type: type,
          is_active: config.is_active,
          send_on_ticket_created: config.send_on_ticket_created,
          send_on_message_received: config.send_on_message_received,
          send_on_status_changed: config.send_on_status_changed,
          config: {
            ...(type === "email_smtp" && {
              smtp_host: config.smtp_host,
              smtp_port: config.smtp_port,
              smtp_user: config.smtp_user,
              smtp_password: config.smtp_password,
              from_email: config.from_email,
              from_name: config.from_name,
            }),
            ...(type === "twilio_sms" && {
              account_sid: config.account_sid,
              auth_token: config.auth_token,
              phone_number: config.phone_number,
            }),
            ...(type === "twilio_whatsapp" && {
              account_sid: config.account_sid,
              auth_token: config.auth_token,
              whatsapp_number: config.whatsapp_number,
            }),
          },
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuración guardada");
      queryClient.invalidateQueries({ queryKey: ["support-integrations"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al guardar configuración");
    },
  });

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configuración de Notificaciones</h1>
          <p className="text-muted-foreground">
            Configura cómo se envían las notificaciones a tus clientes
          </p>
        </div>

        <Tabs defaultValue="sla">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="sla">
              <Clock className="h-4 w-4 mr-2" />
              SLA
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Plantillas
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="sms">
              <Phone className="h-4 w-4 mr-2" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="whatsapp">
              <MessageSquare className="h-4 w-4 mr-2" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          {/* SLA Configuration */}
          <TabsContent value="sla">
            <SLASettingsManager />
          </TabsContent>

          {/* Templates Configuration */}
          <TabsContent value="templates">
            <ResponseTemplatesManager />
          </TabsContent>

          {/* Email Configuration */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Email</CardTitle>
                <CardDescription>
                  Configura el servidor SMTP para enviar emails a tus clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Activar notificaciones por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Envía emails automáticamente a los clientes
                    </p>
                  </div>
                  <Switch
                    checked={emailConfig.is_active}
                    onCheckedChange={(checked) =>
                      setEmailConfig({ ...emailConfig, is_active: checked })
                    }
                  />
                </div>

                {emailConfig.is_active && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Host SMTP</Label>
                        <Input
                          placeholder="smtp.gmail.com"
                          value={emailConfig.smtp_host}
                          onChange={(e) =>
                            setEmailConfig({ ...emailConfig, smtp_host: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Puerto</Label>
                        <Input
                          placeholder="587"
                          value={emailConfig.smtp_port}
                          onChange={(e) =>
                            setEmailConfig({ ...emailConfig, smtp_port: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Usuario SMTP</Label>
                        <Input
                          type="email"
                          placeholder="tu-email@gmail.com"
                          value={emailConfig.smtp_user}
                          onChange={(e) =>
                            setEmailConfig({ ...emailConfig, smtp_user: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contraseña SMTP</Label>
                        <Input
                          type="password"
                          value={emailConfig.smtp_password}
                          onChange={(e) =>
                            setEmailConfig({ ...emailConfig, smtp_password: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email Remitente</Label>
                        <Input
                          type="email"
                          placeholder="soporte@tuempresa.com"
                          value={emailConfig.from_email}
                          onChange={(e) =>
                            setEmailConfig({ ...emailConfig, from_email: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nombre Remitente</Label>
                        <Input
                          placeholder="Soporte Técnico"
                          value={emailConfig.from_name}
                          onChange={(e) =>
                            setEmailConfig({ ...emailConfig, from_name: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <Label>Enviar emails cuando:</Label>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Se crea un nuevo ticket</Label>
                        <Switch
                          checked={emailConfig.send_on_ticket_created}
                          onCheckedChange={(checked) =>
                            setEmailConfig({ ...emailConfig, send_on_ticket_created: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Se recibe un mensaje</Label>
                        <Switch
                          checked={emailConfig.send_on_message_received}
                          onCheckedChange={(checked) =>
                            setEmailConfig({ ...emailConfig, send_on_message_received: checked })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Cambia el estado del ticket</Label>
                        <Switch
                          checked={emailConfig.send_on_status_changed}
                          onCheckedChange={(checked) =>
                            setEmailConfig({ ...emailConfig, send_on_status_changed: checked })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button
                  onClick={() =>
                    saveIntegrationMutation.mutate({
                      type: "email_smtp",
                      config: emailConfig,
                    })
                  }
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS Configuration */}
          <TabsContent value="sms">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de SMS (Twilio)</CardTitle>
                <CardDescription>
                  Envía SMS a tus clientes usando Twilio. Requiere una cuenta en twilio.com
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Activar notificaciones por SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Los SMS tienen costo por mensaje
                    </p>
                  </div>
                  <Switch
                    checked={twilioSMSConfig.is_active}
                    onCheckedChange={(checked) =>
                      setTwilioSMSConfig({ ...twilioSMSConfig, is_active: checked })
                    }
                  />
                </div>

                {twilioSMSConfig.is_active && (
                  <>
                    <div className="space-y-2">
                      <Label>Account SID</Label>
                      <Input
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={twilioSMSConfig.account_sid}
                        onChange={(e) =>
                          setTwilioSMSConfig({ ...twilioSMSConfig, account_sid: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Auth Token</Label>
                      <Input
                        type="password"
                        value={twilioSMSConfig.auth_token}
                        onChange={(e) =>
                          setTwilioSMSConfig({ ...twilioSMSConfig, auth_token: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Número de Teléfono Twilio</Label>
                      <Input
                        placeholder="+1234567890"
                        value={twilioSMSConfig.phone_number}
                        onChange={(e) =>
                          setTwilioSMSConfig({ ...twilioSMSConfig, phone_number: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <Label>Enviar SMS cuando:</Label>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Se crea un nuevo ticket</Label>
                        <Switch
                          checked={twilioSMSConfig.send_on_ticket_created}
                          onCheckedChange={(checked) =>
                            setTwilioSMSConfig({
                              ...twilioSMSConfig,
                              send_on_ticket_created: checked,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Se recibe un mensaje</Label>
                        <Switch
                          checked={twilioSMSConfig.send_on_message_received}
                          onCheckedChange={(checked) =>
                            setTwilioSMSConfig({
                              ...twilioSMSConfig,
                              send_on_message_received: checked,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Cambia el estado del ticket</Label>
                        <Switch
                          checked={twilioSMSConfig.send_on_status_changed}
                          onCheckedChange={(checked) =>
                            setTwilioSMSConfig({
                              ...twilioSMSConfig,
                              send_on_status_changed: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button
                  onClick={() =>
                    saveIntegrationMutation.mutate({
                      type: "twilio_sms",
                      config: twilioSMSConfig,
                    })
                  }
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Configuration */}
          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de WhatsApp</CardTitle>
                <CardDescription>
                  Envía mensajes por WhatsApp usando Twilio WhatsApp Business API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Activar notificaciones por WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">
                      Requiere cuenta Twilio con WhatsApp habilitado
                    </p>
                  </div>
                  <Switch
                    checked={whatsappConfig.is_active}
                    onCheckedChange={(checked) =>
                      setWhatsappConfig({ ...whatsappConfig, is_active: checked })
                    }
                  />
                </div>

                {whatsappConfig.is_active && (
                  <>
                    <div className="space-y-2">
                      <Label>Account SID</Label>
                      <Input
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={whatsappConfig.account_sid}
                        onChange={(e) =>
                          setWhatsappConfig({ ...whatsappConfig, account_sid: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Auth Token</Label>
                      <Input
                        type="password"
                        value={whatsappConfig.auth_token}
                        onChange={(e) =>
                          setWhatsappConfig({ ...whatsappConfig, auth_token: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Número WhatsApp (formato: whatsapp:+1234567890)</Label>
                      <Input
                        placeholder="whatsapp:+1234567890"
                        value={whatsappConfig.whatsapp_number}
                        onChange={(e) =>
                          setWhatsappConfig({ ...whatsappConfig, whatsapp_number: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <Label>Enviar WhatsApp cuando:</Label>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Se crea un nuevo ticket</Label>
                        <Switch
                          checked={whatsappConfig.send_on_ticket_created}
                          onCheckedChange={(checked) =>
                            setWhatsappConfig({
                              ...whatsappConfig,
                              send_on_ticket_created: checked,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Se recibe un mensaje</Label>
                        <Switch
                          checked={whatsappConfig.send_on_message_received}
                          onCheckedChange={(checked) =>
                            setWhatsappConfig({
                              ...whatsappConfig,
                              send_on_message_received: checked,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Cambia el estado del ticket</Label>
                        <Switch
                          checked={whatsappConfig.send_on_status_changed}
                          onCheckedChange={(checked) =>
                            setWhatsappConfig({
                              ...whatsappConfig,
                              send_on_status_changed: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button
                  onClick={() =>
                    saveIntegrationMutation.mutate({
                      type: "twilio_whatsapp",
                      config: whatsappConfig,
                    })
                  }
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
