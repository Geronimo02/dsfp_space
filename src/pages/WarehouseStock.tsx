import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Search, AlertTriangle } from "lucide-react";

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface WarehouseStock {
  id: string;
  stock: number;
  min_stock: number;
  warehouse_id: string;
  products: {
    name: string;
    sku: string;
    category: string;
  };
  warehouses: {
    name: string;
    code: string;
  };
}

export default function WarehouseStock() {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name, code")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Warehouse[];
    },
  });

  const { data: stock, isLoading } = useQuery({
    queryKey: ["warehouse-stock", selectedWarehouse, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("warehouse_stock")
        .select(`
          *,
          products (name, sku, category),
          warehouses (name, code)
        `)
        .order("stock", { ascending: true });

      if (selectedWarehouse !== "all") {
        query = query.eq("warehouse_id", selectedWarehouse);
      }

      if (searchQuery) {
        query = query.ilike("products.name", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as WarehouseStock[];
    },
  });

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Stock por Depósito</h1>
        </div>

        <Card className="p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Seleccionar depósito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los depósitos</SelectItem>
                {warehouses?.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Depósito</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Stock Actual</TableHead>
                  <TableHead>Stock Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock?.map((item, index) => (
                  <TableRow key={item.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <TableCell>
                      <Badge variant="outline">
                        {item.warehouses.code}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.warehouses.name}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.products.name}</TableCell>
                    <TableCell>
                      <code className="text-sm">{item.products.sku}</code>
                    </TableCell>
                    <TableCell>{item.products.category || "-"}</TableCell>
                    <TableCell>
                      <span className={item.stock <= item.min_stock ? "text-destructive font-bold" : ""}>
                        {item.stock}
                      </span>
                    </TableCell>
                    <TableCell>{item.min_stock}</TableCell>
                    <TableCell>
                      {item.stock <= item.min_stock ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Stock Bajo
                        </Badge>
                      ) : item.stock <= item.min_stock * 1.5 ? (
                        <Badge variant="secondary">Stock Medio</Badge>
                      ) : (
                        <Badge variant="default">Stock OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && stock?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron productos
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
