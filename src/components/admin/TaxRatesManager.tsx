// src/components/admin/TaxRatesManager.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { Pencil } from "lucide-react";

export function TaxRatesManager() {
  const queryClient = useQueryClient();
  const [editingRate, setEditingRate] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({ country_code: "", country_name: "", tax_rate: "", tax_name: "" });

  const { data: taxRates, isLoading } = useQuery({
    queryKey: ["tax-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_rates")
        .select("*")
        .order("country_name");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingRate?.id) {
        const { error } = await supabase
          .from("tax_rates")
          .update({
            tax_rate: parseFloat(data.tax_rate),
            tax_name: data.tax_name,
          })
          .eq("id", editingRate.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Tax rate actualizado");
      queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
      setShowDialog(false);
      setEditingRate(null);
      setFormData({ country_code: "", country_name: "", tax_rate: "", tax_name: "" });
    },
    onError: () => {
      toast.error("Error al actualizar tax rate");
    },
  });

  const handleEdit = (rate: any) => {
    setEditingRate(rate);
    setFormData({
      country_code: rate.country_code,
      country_name: rate.country_name,
      tax_rate: rate.tax_rate.toString(),
      tax_name: rate.tax_name,
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  return (
    <>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Tax Rates por País</CardTitle>
          <CardDescription>Configurar tasas de impuesto para cada país</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">País</th>
                    <th className="text-left py-2 px-2">Código</th>
                    <th className="text-left py-2 px-2">Impuesto</th>
                    <th className="text-left py-2 px-2">Nombre</th>
                    <th className="text-left py-2 px-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {taxRates?.map((rate) => (
                    <tr key={rate.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">{rate.country_name}</td>
                      <td className="py-3 px-2">{rate.country_code}</td>
                      <td className="py-3 px-2 font-semibold">{rate.tax_rate}%</td>
                      <td className="py-3 px-2">{rate.tax_name}</td>
                      <td className="py-3 px-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(rate)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tax Rate: {editingRate?.country_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
              />
            </div>
            <div>
              <Label>Nombre del Impuesto (IVA, VAT, etc)</Label>
              <Input
                value={formData.tax_name}
                onChange={(e) => setFormData({ ...formData, tax_name: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
