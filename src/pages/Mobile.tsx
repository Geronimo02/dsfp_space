import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Package, 
  Users, 
  Search,
  ArrowLeft,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type MobileView = "home" | "stock" | "customers" | "pos";

export default function Mobile() {
  const { currentCompany } = useCompany();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<MobileView>("home");
  const [searchQuery, setSearchQuery] = useState("");

  // Stock query
  const { data: stockProducts, isLoading: loadingStock } = useQuery({
    queryKey: ["mobile-stock", searchQuery, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      let query = supabase
        .from("products")
        .select("*")
        .eq("company_id", currentCompany.id)
        .eq("active", true);
      
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,sku.ilike.%${searchQuery}%,barcode.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query.order("name").limit(20);
      if (error) throw error;
      return data;
    },
    enabled: currentView === "stock" && !!currentCompany?.id,
  });

  // Customers query
  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ["mobile-customers", searchQuery, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      let query = supabase
        .from("customers")
        .select("*")
        .eq("company_id", currentCompany.id);
      
      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }
      
      const { data, error } = await query.order("name").limit(20);
      if (error) throw error;
      return data;
    },
    enabled: currentView === "customers" && !!currentCompany?.id,
  });

  const renderHome = () => (
    <div className="space-y-4 p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">RetailSnap</h1>
        <p className="text-muted-foreground text-sm">Modo Móvil</p>
      </div>

      <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => navigate("/pos")}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Punto de Venta</CardTitle>
              <CardDescription>Realizar ventas rápidas</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setCurrentView("stock")}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Consultar Stock</CardTitle>
              <CardDescription>Ver disponibilidad de productos</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => setCurrentView("customers")}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Clientes y Saldos</CardTitle>
              <CardDescription>Consultar cuentas corrientes</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );

  const renderStock = () => (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView("home")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold">Consultar Stock</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar producto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loadingStock ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {stockProducts?.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{product.name}</h3>
                    {product.sku && (
                      <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                    )}
                    <p className="text-lg font-bold text-primary mt-1">
                      ${product.price?.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant={product.stock > (product.min_stock || 0) ? "default" : "destructive"}
                      className="text-base px-3 py-1"
                    >
                      {product.stock} un.
                    </Badge>
                    {product.stock <= (product.min_stock || 0) && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Stock bajo
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {stockProducts?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron productos
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCustomers = () => (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView("home")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold">Clientes y Saldos</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar cliente..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {loadingCustomers ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {customers?.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{customer.name}</h3>
                    {customer.phone && (
                      <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    )}
                    {customer.email && (
                      <p className="text-sm text-muted-foreground">{customer.email}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                    <p className={`text-xl font-bold ${
                      (customer.current_balance || 0) > 0 
                        ? "text-destructive" 
                        : "text-green-600"
                    }`}>
                      ${Math.abs(customer.current_balance || 0).toFixed(2)}
                    </p>
                    {customer.current_balance > 0 && customer.credit_limit > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Límite: ${customer.credit_limit.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-3"
                  onClick={() => navigate(`/customer-account?customer=${customer.id}`)}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Ver Cuenta Corriente
                </Button>
              </CardContent>
            </Card>
          ))}
          {customers?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron clientes
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {currentView === "home" && renderHome()}
      {currentView === "stock" && renderStock()}
      {currentView === "customers" && renderCustomers()}
    </div>
  );
}
