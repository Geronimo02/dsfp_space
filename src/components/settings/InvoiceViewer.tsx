// src/components/settings/InvoiceViewer.tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { useCompany } from "@/contexts/CompanyContext";

export function InvoiceViewer({ companyId: propCompanyId, showAllCompanies = false }: { companyId?: string | null; showAllCompanies?: boolean }) {
  const { currentCompany } = useCompany();
  const companyId = propCompanyId || currentCompany?.id;
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", companyId, showAllCompanies],
    enabled: showAllCompanies || !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, companies(id, company_name)");
      
      if (!showAllCompanies && companyId) {
        query = query.eq("company_id", companyId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDownload = (invoice: any) => {
    if (invoice.pdf_url?.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = invoice.pdf_url;
      link.download = `${invoice.invoice_number}.pdf`;
      link.click();
    }
  };

  return (
    <>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Facturas</CardTitle>
          <CardDescription>Historial de facturas generadas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                ))}
            </div>
          ) : invoices && invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition">
                  <div>
                    <p className="font-semibold">{invoice.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {showAllCompanies && invoice.companies && (
                        <>
                          {invoice.companies.company_name} • {" "}
                        </>
                      )}
                      {format(new Date(invoice.created_at), "dd/MM/yyyy")} • {invoice.currency} {Number(invoice.amount).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {invoice.pdf_url && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowPreview(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownload(invoice)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay facturas generadas.</p>
          )}
        </CardContent>
      </Card>

      {/* PDF Preview */}
      {selectedInvoice && showPreview && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedInvoice.invoice_number}</DialogTitle>
            </DialogHeader>
            {selectedInvoice.pdf_url?.startsWith("data:") && (
              <iframe
                src={selectedInvoice.pdf_url}
                className="w-full h-96 border rounded"
                title="Invoice Preview"
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
