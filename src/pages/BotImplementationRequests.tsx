import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { toast } from "sonner";
import {
  Bot, Search, Plus, Filter, BarChart3,
  FileText, Phone, Send, CheckCircle2, Code2, Rocket,
  XCircle, Ban, Clock, Building2, Mail,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { ContactUsDialog } from "@/components/contact/ContactUsDialog";
import { BotRequestStatusBadge } from "@/components/contact/BotRequestStatusBadge";
import { BotRequestDetailDialog } from "@/components/contact/BotRequestDetailDialog";
import type { BotImplementationRequest, BotRequestStatus, BotRequestActivityLog } from "@/types/botRequests";
import { BOT_REQUEST_STAGES } from "@/types/botRequests";

export default function BotImplementationRequests() {
  const { currentCompany } = useCompany();
  const { isPlatformAdmin } = usePlatformAdmin();
  const queryClient = useQueryClient();

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BotImplementationRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("list");

  // Fetch requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["bot-implementation-requests", currentCompany?.id, isPlatformAdmin],
    queryFn: async () => {
      let query = supabase
        .from("bot_implementation_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });

      // Non-admin users only see their company's requests
      if (!isPlatformAdmin && currentCompany?.id) {
        query = query.eq("company_id", currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]) as BotImplementationRequest[];
    },
  });

  // Fetch activity log for selected request
  const { data: activityLog = [] } = useQuery({
    queryKey: ["bot-request-activity", selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const { data, error } = await supabase
        .from("bot_request_activity_log" as any)
        .select("*")
        .eq("request_id", selectedRequest.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as BotRequestActivityLog[];
    },
    enabled: !!selectedRequest,
  });

  // Filtered requests
  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      !searchTerm ||
      req.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.contact_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === "all" || req.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Pipeline counts
  const statusCounts = BOT_REQUEST_STAGES.reduce((acc, stage) => {
    acc[stage.value] = requests.filter((r) => r.status === stage.value).length;
    return acc;
  }, {} as Record<string, number>);

  const handleRequestClick = (request: BotImplementationRequest) => {
    setSelectedRequest(request);
    setIsDetailOpen(true);
  };

  const handleUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["bot-implementation-requests"] });
    queryClient.invalidateQueries({ queryKey: ["bot-request-activity"] });
  };

  return (
    <Layout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isPlatformAdmin ? "Pipeline de Bots Personalizados" : "Mis Solicitudes de Bot"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isPlatformAdmin
                  ? "Gestiona las solicitudes de implementación de bots personalizados"
                  : "Consulta el estado de tus solicitudes de bot personalizado"}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsContactDialogOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Solicitud
          </Button>
        </div>

        {/* Pipeline Overview Cards */}
        {isPlatformAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {BOT_REQUEST_STAGES.filter((s) => !["no_aprobado", "cancelado"].includes(s.value)).map(
              (stage) => (
                <Card
                  key={stage.value}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    statusFilter === stage.value ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() =>
                    setStatusFilter(statusFilter === stage.value ? "all" : stage.value)
                  }
                >
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold">{statusCounts[stage.value] || 0}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                      {stage.label}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email, asunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {BOT_REQUEST_STAGES.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label} ({statusCounts[stage.value] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Request List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">
                {requests.length === 0 ? "Sin solicitudes" : "Sin resultados"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {requests.length === 0
                  ? "No hay solicitudes de bot personalizado. ¡Crea la primera!"
                  : "No se encontraron solicitudes con los filtros aplicados."}
              </p>
              {requests.length === 0 && (
                <Button
                  onClick={() => setIsContactDialogOpen(true)}
                  className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Solicitar Bot Personalizado
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredRequests.map((request) => (
              <Card
                key={request.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.995]"
                onClick={() => handleRequestClick(request)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Left: Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{request.subject}</h3>
                        <BotRequestStatusBadge status={request.status} size="sm" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {request.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {request.contact_name}
                          {request.company_name ? ` · ${request.company_name}` : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {request.contact_email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(request.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Right: Budget info if available */}
                    {request.budget_price != null && (
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-primary">
                          ${request.budget_price.toLocaleString("es-AR")}
                        </div>
                        <div className="text-[10px] text-muted-foreground">ARS</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ContactUsDialog
        open={isContactDialogOpen}
        onOpenChange={setIsContactDialogOpen}
      />
      <BotRequestDetailDialog
        request={selectedRequest}
        activityLog={activityLog}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onUpdated={handleUpdated}
        isAdmin={isPlatformAdmin}
      />
    </Layout>
  );
}
