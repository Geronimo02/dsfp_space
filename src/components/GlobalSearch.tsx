import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Package, Users, FileText, TrendingUp, ShoppingCart, FileCheck } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Button } from "@/components/ui/button";
import { sanitizeSearchQuery } from "@/lib/searchUtils";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Buscar productos
  const { data: products = [] } = useQuery({
    queryKey: ["search-products", search, currentCompany?.id],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const sanitized = sanitizeSearchQuery(search);
      if (!sanitized) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, barcode")
        .eq("company_id", currentCompany?.id)
        .or(`name.ilike.%${sanitized}%,sku.ilike.%${sanitized}%,barcode.ilike.%${sanitized}%`)
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id && search.length >= 2,
  });

  // Buscar clientes
  const { data: customers = [] } = useQuery({
    queryKey: ["search-customers", search, currentCompany?.id],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const sanitized = sanitizeSearchQuery(search);
      if (!sanitized) return [];
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, document")
        .eq("company_id", currentCompany?.id)
        .or(`name.ilike.%${sanitized}%,document.ilike.%${sanitized}%`)
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id && search.length >= 2,
  });

  // Buscar facturas/ventas
  const { data: sales = [] } = useQuery({
    queryKey: ["search-sales", search, currentCompany?.id],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const sanitized = sanitizeSearchQuery(search);
      if (!sanitized) return [];
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, total, customers(name)")
        .eq("company_id", currentCompany?.id)
        .ilike("sale_number", `%${sanitized}%`)
        .limit(5);
      
      if (error) throw error;
      return data?.map(sale => ({
        id: sale.id,
        sale_number: sale.sale_number,
        customer_name: (sale.customers as any)?.name || "Sin cliente",
        total: sale.total
      })) || [];
    },
    enabled: !!currentCompany?.id && search.length >= 2,
  });

  // Buscar presupuestos
  const { data: quotations = [] } = useQuery({
    queryKey: ["search-quotations", search, currentCompany?.id],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const sanitized = sanitizeSearchQuery(search);
      if (!sanitized) return [];
      const { data, error } = await supabase
        .from("quotations")
        .select("id, quotation_number, customer_name, total")
        .eq("company_id", currentCompany?.id)
        .or(`quotation_number.ilike.%${sanitized}%,customer_name.ilike.%${sanitized}%`)
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id && search.length >= 2,
  });

  // Buscar remitos
  const { data: deliveryNotes = [] } = useQuery({
    queryKey: ["search-delivery-notes", search, currentCompany?.id],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      const sanitized = sanitizeSearchQuery(search);
      if (!sanitized) return [];
      const { data, error } = await supabase
        .from("delivery_notes")
        .select("id, delivery_number, customer_name, total")
        .eq("company_id", currentCompany?.id)
        .or(`delivery_number.ilike.%${sanitized}%,customer_name.ilike.%${sanitized}%`)
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id && search.length >= 2,
  });

  const handleSelect = (type: string, id: string) => {
    setOpen(false);
    setSearch("");
    
    switch (type) {
      case "product":
        navigate(`/products`);
        break;
      case "customer":
        navigate(`/customers`);
        break;
      case "sale":
        navigate(`/sales`);
        break;
      case "quotation":
        navigate(`/quotations`);
        break;
      case "delivery":
        navigate(`/delivery-notes`);
        break;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Buscar...</span>
        <span className="inline-flex lg:hidden">Buscar</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Buscar productos, clientes, facturas..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {search.length < 2 
              ? "Escribe al menos 2 caracteres para buscar..."
              : "No se encontraron resultados."}
          </CommandEmpty>

          {products.length > 0 && (
            <CommandGroup heading="Productos">
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  onSelect={() => handleSelect("product", product.id)}
                  className="cursor-pointer"
                >
                  <Package className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.sku && `SKU: ${product.sku}`}
                      {product.barcode && ` | Código: ${product.barcode}`}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {customers.length > 0 && (
            <CommandGroup heading="Clientes">
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  onSelect={() => handleSelect("customer", customer.id)}
                  className="cursor-pointer"
                >
                  <Users className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium">{customer.name}</div>
                    {customer.document && (
                      <div className="text-xs text-muted-foreground">
                        Doc: {customer.document}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {sales.length > 0 && (
            <CommandGroup heading="Ventas/Facturas">
              {sales.map((sale) => (
                <CommandItem
                  key={sale.id}
                  onSelect={() => handleSelect("sale", sale.id)}
                  className="cursor-pointer"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium">{sale.sale_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {sale.customer_name} - ${Number(sale.total).toFixed(2)}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {quotations.length > 0 && (
            <CommandGroup heading="Presupuestos">
              {quotations.map((quotation) => (
                <CommandItem
                  key={quotation.id}
                  onSelect={() => handleSelect("quotation", quotation.id)}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium">{quotation.quotation_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {quotation.customer_name} - ${Number(quotation.total).toFixed(2)}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {deliveryNotes.length > 0 && (
            <CommandGroup heading="Remitos">
              {deliveryNotes.map((note) => (
                <CommandItem
                  key={note.id}
                  onSelect={() => handleSelect("delivery", note.id)}
                  className="cursor-pointer"
                >
                  <FileCheck className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium">{note.delivery_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {note.customer_name} - ${Number(note.total).toFixed(2)}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
