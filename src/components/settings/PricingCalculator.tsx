import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, Building2, Check } from "lucide-react";
import {
  usePricingConfig,
  usePlatformModules,
  useCalculatePriceManual,
} from "@/hooks/usePricingConfig";
import { formatCurrency } from "@/lib/exportUtils";
import { useNavigate } from "react-router-dom";

export function PricingCalculator() {
  const { data: config } = usePricingConfig();
  const { data: modules } = usePlatformModules();
  const { calculatePrice } = useCalculatePriceManual();
  const navigate = useNavigate();

  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [invoiceVolume, setInvoiceVolume] = useState<number>(0);
  const [showInternalBreakdown, setShowInternalBreakdown] = useState(false);

  // Inicializar módulos base seleccionados cuando carguen los módulos
  useEffect(() => {
    if (modules && selectedModules.length === 0) {
      const baseModules = modules.filter((m) => m.is_base_module).map((m) => m.id);
      setSelectedModules(baseModules);
    }
  }, [modules]);

  const toggleModule = (moduleId: string) => {
    if (selectedModules.includes(moduleId)) {
      setSelectedModules(selectedModules.filter((id) => id !== moduleId));
    } else {
      setSelectedModules([...selectedModules, moduleId]);
    }
  };

  const calculation = calculatePrice(selectedModules, billingCycle, invoiceVolume);
  
  // Debug: Log para verificar el cálculo
  console.log('🔍 DEBUG PRICING:', {
    selectedModules,
    selectedModulesCount: selectedModules.length,
    additionalModulesCount: selectedModules.filter(id => {
      const m = modules?.find(mod => mod.id === id);
      return m && !m.is_base_module;
    }).length,
    calculation,
    billingCycle,
    invoiceVolume
  });

  const baseModules = modules?.filter((m) => m.is_base_module) || [];
  const additionalModules = modules?.filter((m) => !m.is_base_module) || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cotizador de Precios</h2>
          <p className="text-muted-foreground mt-1">
            Genera cotizaciones personalizadas para nuevos clientes
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Configuración */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ciclo de Facturación */}
          <Card className="border-2">
            <CardHeader className="bg-muted/50">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calculator className="h-5 w-5" />
                Calculadora de Cotización
              </CardTitle>
              <CardDescription className="mt-1.5">
                Selecciona módulos y configura el volumen para calcular el precio
              </CardDescription>
            </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Toggle Mensual/Anual */}
            <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
              <span className={`text-lg font-semibold transition-all ${billingCycle === "monthly" ? "text-blue-700 scale-110" : "text-muted-foreground"}`}>
                💳 Mensual
              </span>
              <Switch
                checked={billingCycle === "annual"}
                onCheckedChange={(checked) => setBillingCycle(checked ? "annual" : "monthly")}
                className="data-[state=checked]:bg-purple-600"
              />
              <span className={`text-lg font-semibold transition-all ${billingCycle === "annual" ? "text-purple-700 scale-110" : "text-muted-foreground"}`}>
                📅 Anual
              </span>
              {config && billingCycle === "annual" && (
                <Badge className="ml-2 bg-green-600 text-white px-3 py-1">
                  🎁 Ahorro {config.annual_discount_percentage}%
                </Badge>
              )}
            </div>

            {/* Volumen de Facturas */}
            <div className="space-y-2">
              <Label htmlFor="invoice-volume">Volumen Estimado de Facturas Mensuales</Label>
              <Input
                id="invoice-volume"
                type="number"
                value={invoiceVolume}
                onChange={(e) => setInvoiceVolume(parseInt(e.target.value) || 0)}
                placeholder="Ej: 250"
              />
              {config && invoiceVolume > 0 && (
                <p className="text-sm text-muted-foreground">
                  Rango:{" "}
                  {config.invoice_volume_tiers.find(
                    (t) => invoiceVolume >= t.min && (t.max === null || invoiceVolume <= t.max)
                  )?.min || 0}
                  {" - "}
                  {config.invoice_volume_tiers.find(
                    (t) => invoiceVolume >= t.min && (t.max === null || invoiceVolume <= t.max)
                  )?.max || "∞"}{" "}
                  facturas
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Módulos Base */}
        <Card>
          <CardHeader>
            <CardTitle>Módulos Base (Incluidos)</CardTitle>
            <CardDescription>Estos módulos están siempre incluidos en el paquete</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {baseModules.map((module) => (
                <div
                  key={module.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{module.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{module.description}</p>
                  </div>
                  <Badge variant="outline">Base</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Módulos Adicionales */}
        <Card>
          <CardHeader>
            <CardTitle>Módulos Adicionales</CardTitle>
            <CardDescription>Selecciona los módulos adicionales que necesitas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {additionalModules.map((module) => {
                const isSelected = selectedModules.includes(module.id);
                const price = billingCycle === "annual" ? module.price_annual : module.price_monthly;

                return (
                  <div
                    key={module.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "hover:border-gray-400 hover:bg-gray-50"
                    }`}
                    onClick={() => toggleModule(module.id)}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${
                        isSelected ? "bg-primary text-white" : "bg-gray-200"
                      }`}
                    >
                      {isSelected && <Check className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{module.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{module.description}</p>
                      <p className="text-xs font-semibold text-primary mt-1">
                        +{formatCurrency(price)}
                        {billingCycle === "monthly" ? "/mes" : "/año"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel de Resumen */}
      <div className="lg:col-span-1">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle>Resumen de Cotización</CardTitle>
            <CardDescription>
              {billingCycle === "monthly" ? "Pago Mensual" : "Pago Anual"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Vista del Cliente - Precio Final */}
            <div className="space-y-4">
              <div className="p-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl text-center shadow-xl">
                <p className="text-sm text-blue-100 mb-3 font-medium uppercase tracking-wide">
                  💰 Precio Final para el Cliente
                </p>
                <p className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
                  {formatCurrency(calculation.total_price)}
                </p>
                <p className="text-base text-blue-100 font-medium">
                  {billingCycle === "monthly" ? "por mes" : "por año"}
                </p>
              </div>

              {billingCycle === "annual" && config && (
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">🎉</span>
                    <p className="text-sm text-green-800 font-bold">
                      Ahorrás {config.annual_discount_percentage}% pagando anual
                    </p>
                  </div>
                  <p className="text-xs text-green-700 font-medium">
                    💵 Equivalente a {formatCurrency(calculation.total_price / 12)}/mes
                  </p>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Toggle para vista interna */}
            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔓</span>
                <Label htmlFor="show-breakdown" className="text-sm font-semibold text-amber-900 cursor-pointer">
                  Ver desglose interno (Solo Admin)
                </Label>
              </div>
              <Switch
                id="show-breakdown"
                checked={showInternalBreakdown}
                onCheckedChange={setShowInternalBreakdown}
              />
            </div>

            {/* Desglose Interno (solo para admin) */}
            {showInternalBreakdown && (
              <div className="space-y-3 pt-2 border-t-2 border-dashed">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📊</span>
                  <p className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Desglose Interno
                  </p>
                </div>
                <div className="space-y-2.5 text-sm bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">📦 Paquete Base:</span>
                    <span className="font-bold text-blue-600">{formatCurrency(calculation.base_price)}</span>
                  </div>
                  
                  {/* Desglose detallado de módulos adicionales */}
                  <div className="space-y-1 bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <div className="flex justify-between items-center font-semibold text-purple-800">
                      <span>🔧 Módulos Adicionales:</span>
                      <span className="font-bold">{formatCurrency(calculation.modules_price)}</span>
                    </div>
                    {selectedModules
                      .map((id) => modules?.find((m) => m.id === id))
                      .filter((m) => m && !m.is_base_module)
                      .map((module) => {
                        if (!module) return null;
                        const price = billingCycle === "annual" ? module.price_annual : module.price_monthly;
                        return (
                          <div key={module.id} className="flex justify-between items-center pl-3 text-xs">
                            <span className="text-purple-700">↳ {module.name}</span>
                            <span className="font-semibold text-purple-600">+{formatCurrency(price)}</span>
                          </div>
                        );
                      })}
                    {selectedModules.filter((id) => {
                      const m = modules?.find((mod) => mod.id === id);
                      return m && !m.is_base_module;
                    }).length === 0 && (
                      <div className="text-xs text-purple-600 pl-3 italic">Sin módulos adicionales seleccionados</div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">📈 Volumen de Facturas:</span>
                    <span className="font-bold text-orange-600">{formatCurrency(calculation.volume_price)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-base pt-2 bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg border border-green-200">
                    <span className="text-green-800">💵 Total:</span>
                    <span className="text-green-700">{formatCurrency(calculation.total_price)}</span>
                  </div>
                </div>

                <div className="pt-3 text-xs text-muted-foreground space-y-1">
                  <p>
                    • {selectedModules.filter((id) => !baseModules.find((m) => m.id === id)).length}{" "}
                    módulos adicionales seleccionados
                  </p>
                  <p>• {invoiceVolume} facturas/mes estimadas</p>
                  <p>
                    • Plan {billingCycle === "monthly" ? "Mensual" : "Anual"}
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Acciones */}
            <div className="space-y-2">
              <Button className="w-full" size="lg">
                <Building2 className="h-4 w-4 mr-2" />
                Crear Empresa con esta Configuración
              </Button>
              <Button variant="outline" className="w-full">
                Guardar Cotización
              </Button>
            </div>

            {/* Información adicional */}
            <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
              <p>
                Este precio es el que se comunica al cliente. El desglose interno es solo para
                referencia administrativa.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
