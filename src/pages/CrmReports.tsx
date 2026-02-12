import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { useCompany } from "@/contexts/CompanyContext";

const DATE_RANGES = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "180", label: "Últimos 180 días" },
  { value: "365", label: "Últimos 12 meses" },
  { value: "custom", label: "Rango personalizado" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value);

const normalizeStatus = (value?: string | null) => (value ?? "").trim().toLowerCase();

const isWon = (status?: string | null, stage?: string | null) => {
  const statusValue = normalizeStatus(status);
  const stageValue = normalizeStatus(stage);
  return statusValue.includes("ganad") || statusValue.includes("won") || stageValue.includes("ganad");
};

const isLost = (status?: string | null, stage?: string | null) => {
  const statusValue = normalizeStatus(status);
  const stageValue = normalizeStatus(stage);
  return statusValue.includes("perdid") || statusValue.includes("lost") || stageValue.includes("perdid");
};

export default function CrmReports() {
  const { currentCompany } = useCompany();
  const [dateRangeType, setDateRangeType] = useState("30");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const getDateRange = () => {
    if (dateRangeType === "custom" && customDateRange?.from && customDateRange?.to) {
      return {
        start: startOfDay(customDateRange.from),
        end: endOfDay(customDateRange.to),
      };
    }
    const days = Number(dateRangeType);
    return {
      start: startOfDay(subDays(new Date(), days)),
      end: endOfDay(new Date()),
    };
  };

  const { data: pipelines = [] } = useQuery({
    queryKey: ["crm-pipelines", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .select("id, name, stages")
        .eq("company_id", currentCompany?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: opportunities = [], isFetching, refetch } = useQuery({
    queryKey: ["crm-reports-opportunities", currentCompany?.id, dateRangeType, customDateRange],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { start, end } = getDateRange();
      const { data, error } = await supabase
        .from("crm_opportunities")
        .select("id, pipeline_id, stage, value, status, created_at, close_date")
        .eq("company_id", currentCompany.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentCompany?.id,
  });

  const kpis = useMemo(() => {
    const totalCount = opportunities.length;
    const totalValue = opportunities.reduce(
      (sum, opp) => sum + (Number(opp.value) || 0),
      0
    );
    const averageValue = totalCount ? totalValue / totalCount : 0;

    const wonCount = opportunities.filter((opp) => isWon(opp.status, opp.stage)).length;
    const lostCount = opportunities.filter((opp) => isLost(opp.status, opp.stage)).length;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount ? (wonCount / closedCount) * 100 : 0;

    const cycleDays = opportunities
      .filter((opp) => opp.close_date && opp.created_at)
      .map((opp) =>
        differenceInDays(new Date(opp.close_date as string), new Date(opp.created_at as string))
      );
    const avgCycle = cycleDays.length
      ? cycleDays.reduce((sum, days) => sum + days, 0) / cycleDays.length
      : 0;

    return {
      totalCount,
      totalValue,
      averageValue,
      wonCount,
      lostCount,
      winRate,
      avgCycle,
    };
  }, [opportunities]);

  const pipelineOverview = useMemo(() => {
    return pipelines.map((pipeline: any) => {
      const pipelineOpportunities = opportunities.filter(
        (opp) => opp.pipeline_id === pipeline.id
      );
      const totalValue = pipelineOpportunities.reduce(
        (sum, opp) => sum + (Number(opp.value) || 0),
        0
      );
      return {
        id: pipeline.id,
        name: pipeline.name,
        totalValue,
        count: pipelineOpportunities.length,
      };
    });
  }, [pipelines, opportunities]);

  const pipelineFunnels = useMemo(() => {
    return pipelines.map((pipeline: any) => {
      const pipelineOpportunities = opportunities.filter(
        (opp) => opp.pipeline_id === pipeline.id
      );
      const funnel = (pipeline.stages || []).map((stage: string) => {
        const stageOpps = pipelineOpportunities.filter((opp) => opp.stage === stage);
        return {
          stage,
          count: stageOpps.length,
          value: stageOpps.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0),
        };
      });
      return {
        id: pipeline.id,
        name: pipeline.name,
        data: funnel,
      };
    });
  }, [pipelines, opportunities]);

  const dateLabel = useMemo(() => {
    if (dateRangeType !== "custom") {
      const option = DATE_RANGES.find((item) => item.value === dateRangeType);
      return option?.label ?? "";
    }
    if (customDateRange?.from && customDateRange?.to) {
      return `${format(customDateRange.from, "dd/MM/yyyy")} - ${format(
        customDateRange.to,
        "dd/MM/yyyy"
      )}`;
    }
    return "Rango personalizado";
  }, [dateRangeType, customDateRange]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reporting CRM</h1>
            <p className="text-sm text-muted-foreground">
              Dashboards de KPIs y embudos por pipeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={dateRangeType} onValueChange={setDateRangeType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Rango" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    dateRangeType !== "custom" && "opacity-70"
                  )}
                  disabled={dateRangeType !== "custom"}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={customDateRange}
                  onSelect={setCustomDateRange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total oportunidades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpis.totalCount}</div>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Valor total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(kpis.totalValue)}</div>
              <p className="text-xs text-muted-foreground">Promedio {formatCurrency(kpis.averageValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tasa de cierre</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpis.winRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Ganadas {kpis.wonCount} · Perdidas {kpis.lostCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ciclo promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{kpis.avgCycle.toFixed(1)} días</div>
              <p className="text-xs text-muted-foreground">Basado en oportunidades cerradas</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Valor por pipeline</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {pipelineOverview.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineOverview} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="totalValue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-muted-foreground">Sin datos.</div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {pipelineFunnels.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardHeader>
                <CardTitle>Embudo — {pipeline.name}</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {pipeline.data.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={pipeline.data}
                      layout="vertical"
                      margin={{ top: 10, right: 16, left: 32, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="stage" type="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number, name: string) =>
                          name === "value" ? formatCurrency(value) : value
                        }
                        labelStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">Sin datos para este pipeline.</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
