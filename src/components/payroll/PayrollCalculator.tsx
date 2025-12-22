import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface PayrollCalculatorProps {
  companyId: string;
  baseSalary: number;
  workedDays?: number;
  absentDays?: number;
  overtimeHours50?: number;
  overtimeHours100?: number;
}

interface CalculationResult {
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  employerContributions: number;
  deductions: { name: string; amount: number; rate: number }[];
  contributions: { name: string; amount: number; rate: number }[];
}

export const PayrollCalculator = ({
  companyId,
  baseSalary,
  workedDays = 30,
  absentDays = 0,
  overtimeHours50 = 0,
  overtimeHours100 = 0,
}: PayrollCalculatorProps) => {
  const [result, setResult] = useState<CalculationResult | null>(null);

  const { data: contributionRates } = useQuery({
    queryKey: ["contribution_rates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_contribution_rates")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (!baseSalary) return;

    // Default rates if no custom rates configured
    const defaultRates = {
      deductions: [
        { name: "Jubilación", code: "JUBILACION", employeeRate: 11, employerRate: 10.17 },
        { name: "PAMI", code: "PAMI", employeeRate: 3, employerRate: 1.5 },
        { name: "Obra Social", code: "OBRA_SOCIAL", employeeRate: 3, employerRate: 6 },
        { name: "Sindicato", code: "SINDICATO", employeeRate: 2, employerRate: 0 },
      ],
      contributions: [
        { name: "ART", code: "ART", rate: 2.5 },
        { name: "Seguro de Vida", code: "SEGURO_VIDA", rate: 0.03 },
      ],
    };

    // Calculate proportional salary based on worked days
    const effectiveDays = workedDays - absentDays;
    const dailySalary = baseSalary / 30;
    const proportionalSalary = dailySalary * effectiveDays;

    // Calculate overtime
    const hourlyRate = baseSalary / 200; // 200 hours/month average
    const overtime50 = overtimeHours50 * hourlyRate * 1.5;
    const overtime100 = overtimeHours100 * hourlyRate * 2;

    // Gross salary
    const grossSalary = proportionalSalary + overtime50 + overtime100;

    // Calculate deductions (employee contributions)
    const deductions = defaultRates.deductions.map((rate) => ({
      name: rate.name,
      amount: (grossSalary * rate.employeeRate) / 100,
      rate: rate.employeeRate,
    }));

    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

    // Calculate employer contributions
    const contributions = [
      ...defaultRates.deductions
        .filter((r) => r.employerRate > 0)
        .map((rate) => ({
          name: `${rate.name} (Empleador)`,
          amount: (grossSalary * rate.employerRate) / 100,
          rate: rate.employerRate,
        })),
      ...defaultRates.contributions.map((rate) => ({
        name: rate.name,
        amount: (grossSalary * rate.rate) / 100,
        rate: rate.rate,
      })),
    ];

    const employerContributions = contributions.reduce((sum, c) => sum + c.amount, 0);

    setResult({
      grossSalary,
      totalDeductions,
      netSalary: grossSalary - totalDeductions,
      employerContributions,
      deductions,
      contributions,
    });
  }, [baseSalary, workedDays, absentDays, overtimeHours50, overtimeHours100, contributionRates]);

  if (!result) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="h-5 w-5" />
          Cálculo de Liquidación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Sueldo Bruto</p>
            <p className="text-lg font-semibold">${result.grossSalary.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-destructive/10 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Deducciones
            </p>
            <p className="text-lg font-semibold text-destructive">
              -${result.totalDeductions.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-primary/10 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> Sueldo Neto
            </p>
            <p className="text-lg font-bold text-primary">
              ${result.netSalary.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-amber-500/10 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Cargas Sociales
            </p>
            <p className="text-lg font-semibold text-amber-600">
              ${result.employerContributions.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <Separator />

        {/* Deductions Detail */}
        <div>
          <h4 className="text-sm font-medium mb-2">Deducciones del Empleado</h4>
          <div className="space-y-1">
            {result.deductions.map((d, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {d.name} <Badge variant="outline" className="ml-1 text-xs">{d.rate}%</Badge>
                </span>
                <span className="font-medium">-${d.amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Employer Contributions Detail */}
        <div>
          <h4 className="text-sm font-medium mb-2">Aportes Patronales</h4>
          <div className="space-y-1">
            {result.contributions.map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {c.name} <Badge variant="outline" className="ml-1 text-xs">{c.rate}%</Badge>
                </span>
                <span className="font-medium">${c.amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-muted p-3 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium">Costo Total Empleador</span>
            <span className="text-xl font-bold">
              ${(result.grossSalary + result.employerContributions).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
