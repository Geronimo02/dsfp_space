import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { Plus, Edit, Trash2, Search, Upload, Download, X, Package, ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import Papa from "papaparse";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCompany } from "@/contexts/CompanyContext";

const productSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(200, "El nombre debe tener máximo 200 caracteres"),
  price: z.number({ invalid_type_error: "El precio debe ser un número" })
    .positive("El precio debe ser mayor a 0")
    .max(999999.99, "El precio debe ser menor a 1,000,000"),
  cost: z.number({ invalid_type_error: "El costo debe ser un número" })
    .nonnegative("El costo no puede ser negativo")
    .max(999999.99, "El costo debe ser menor a 1,000,000")
    .optional(),
  stock: z.number({ invalid_type_error: "El stock debe ser un número" })
    .int("El stock debe ser un número entero")
    .nonnegative("El stock no puede ser negativo")
    .max(1000000, "El stock debe ser menor a 1,000,000"),
  min_stock: z.number({ invalid_type_error: "El stock mínimo debe ser un número" })
    .int("El stock mínimo debe ser un número entero")
    .nonnegative("El stock mínimo no puede ser negativo")
    .max(1000000, "El stock mínimo debe ser menor a 1,000,000")
    .optional(),
  category: z.string().max(100, "La categoría debe tener máximo 100 caracteres").optional(),
  barcode: z.string().max(50, "El código de barras debe tener máximo 50 caracteres").optional(),
  sku: z.string().max(50, "El SKU debe tener máximo 50 caracteres").optional(),
  location: z.string().max(100, "La ubicación debe tener máximo 100 caracteres").optional(),
  batch_number: z.string().max(50, "El número de lote debe tener máximo 50 caracteres").optional(),
  expiration_date: z.string().optional(),
});

export default function Products() {
  const { currentCompany } = useCompany();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canCreate = hasPermission('products', 'create');
  const canEdit = hasPermission('products', 'edit');
  const canDelete = hasPermission('products', 'delete');
  const canExport = hasPermission('products', 'export');

  // Verificar que el usuario tenga acceso a la empresa actual
  useEffect(() => {
    if (!permissionsLoading && currentCompany && !hasPermission('products', 'view')) {
      toast.error("No tienes acceso a los productos de esta empresa");
      console.warn("Usuario sin acceso a empresa", { currentCompany });
    }
  }, [currentCompany, permissionsLoading, hasPermission]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    sku: "",
    price: "",
    cost: "",
    stock: "",
    min_stock: "",
    category: "",
    location: "",
    batch_number: "",
    expiration_date: "",
  });
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isMassEditDialogOpen, setIsMassEditDialogOpen] = useState(false);
  const [massEditData, setMassEditData] = useState({
    price: "",
    cost: "",
    stock: "",
    category: "",
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [warehouseStockData, setWarehouseStockData] = useState<Record<string, Record<string, number>>>({});
  const [isStockAdjustDialogOpen, setIsStockAdjustDialogOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<any>(null);
  const [stockAdjustments, setStockAdjustments] = useState<Record<string, string>>({});
  const [isPriceListDialogOpen, setIsPriceListDialogOpen] = useState(false);
  const [priceListProduct, setPriceListProduct] = useState<any>(null);
  const [priceListPrices, setPriceListPrices] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", searchQuery, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = supabase.from("products").select("*").eq("company_id", currentCompany.id).order("created_at", { ascending: false });
      
      if (searchQuery) {
        const sanitized = sanitizeSearchQuery(searchQuery);
        if (sanitized) {
          query = query.or(`name.ilike.%${sanitized}%,barcode.ilike.%${sanitized}%,sku.ilike.%${sanitized}%`);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("company_id", currentCompany?.id)
        .eq("active", true)
        .order("is_main", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: priceLists } = useQuery({
    queryKey: ["price-lists", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name, is_default")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch warehouse stock for expanded products
  const { data: warehouseStock } = useQuery({
    queryKey: ["warehouse-stock-detail", Array.from(expandedProducts)],
    queryFn: async () => {
      if (expandedProducts.size === 0) return [];
      
      const { data, error } = await supabase
        .from("warehouse_stock")
        .select(`
          *,
          warehouses (code, name)
        `)
        .in("product_id", Array.from(expandedProducts));
      
      if (error) throw error;
      return data;
    },
    enabled: expandedProducts.size > 0,
  });

  // Fetch product prices for price list dialog
  const { data: productPrices } = useQuery({
    queryKey: ["product-prices", priceListProduct?.id],
    queryFn: async () => {
      if (!priceListProduct?.id) return [];
      
      const { data, error } = await supabase
        .from("product_prices")
        .select("*, price_lists(name)")
        .eq("product_id", priceListProduct.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!priceListProduct?.id,
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentCompany?.id) throw new Error('Empresa no seleccionada');
      if (!canCreate) throw new Error('No tienes permiso para crear productos en esta empresa');
      
      // Verificar que el usuario realmente tiene rol adecuado en esta empresa
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');
      
      const { data: userCompanyCheck, error: checkError } = await supabase
        .from('company_users')
        .select('role, active')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .eq('active', true)
        .maybeSingle();

      if (checkError) {
        console.error('Error verificando permisos de empresa:', checkError);
        throw new Error('Error verificando permisos');
      }

      if (!userCompanyCheck) {
        throw new Error(`No tienes acceso a la empresa ${currentCompany.name}. Por favor selecciona otra empresa o contacta al administrador.`);
      }

      if (!['admin', 'manager'].includes(userCompanyCheck.role)) {
        throw new Error(`Tu rol (${userCompanyCheck.role}) no tiene permisos para crear productos. Necesitas ser admin o gerente.`);
      }

      // Forzar company_id correcto
      const payload = { ...data, company_id: currentCompany.id };
      const { data: product, error } = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      
      // Create warehouse stock entries if distribution was configured
      if (warehouses && warehouseStockData["new"] && Object.keys(warehouseStockData["new"]).length > 0) {
        const warehouseStockEntries = Object.entries(warehouseStockData["new"]).map(([warehouseId, stock]) => ({
          warehouse_id: warehouseId,
          product_id: product.id,
          stock: stock || 0,
          min_stock: data.min_stock || 0,
          company_id: currentCompany!.id,
        }));
        
        const { error: stockError } = await supabase
          .from("warehouse_stock")
          .insert(warehouseStockEntries);
        
        if (stockError) throw stockError;
      }
      
      return product;
    },
    onSuccess: () => {
      toast.success("Producto creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      setIsDialogOpen(false);
      resetForm();
      setWarehouseStockData({});
    },
    onError: (error: any) => {
      const msg = error?.message || '';
      if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('403')) {
        toast.error("No tienes permisos para crear productos en esta empresa. Verifica que seas admin o gerente.");
        console.error('RLS error creating product', { 
          currentCompany, 
          canCreate, 
          error,
          mensaje: 'Posible causa: Usuario no tiene rol admin/manager en company_users para esta empresa'
        });
      } else if (msg.includes('No tienes permiso')) {
        toast.error(msg);
      } else {
        toast.error(error.message || "Error al crear producto");
      }
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase.from("products").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Producto actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al actualizar producto");
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Producto eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al eliminar producto");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      barcode: "",
      sku: "",
      price: "",
      cost: "",
      stock: "",
      min_stock: "",
      category: "",
      location: "",
      batch_number: "",
      expiration_date: "",
    });
    setEditingProduct(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!currentCompany?.id) {
        toast.error("No hay empresa seleccionada. Selecciona una empresa antes de crear productos.");
        return;
      }
      // Validate warehouse distribution if provided
      if (warehouseStockData["new"]) {
        const totalDistributed = Object.values(warehouseStockData["new"]).reduce((sum, val) => sum + (val || 0), 0);
        const totalStock = parseInt(formData.stock);
        
        if (totalDistributed > 0 && totalDistributed !== totalStock) {
          toast.error(`La distribución (${totalDistributed}) debe coincidir con el stock total (${totalStock})`);
          return;
        }
      }

      const validatedData = productSchema.parse({
        name: formData.name,
        price: parseFloat(formData.price),
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        stock: parseInt(formData.stock),
        min_stock: formData.min_stock ? parseInt(formData.min_stock) : undefined,
        category: formData.category || undefined,
        barcode: formData.barcode || undefined,
        sku: formData.sku || undefined,
        location: formData.location || undefined,
        batch_number: formData.batch_number || undefined,
        expiration_date: formData.expiration_date || undefined,
      });

      const productData = {
        name: validatedData.name,
        barcode: validatedData.barcode || null,
        sku: validatedData.sku || null,
        price: validatedData.price,
        cost: validatedData.cost ?? 0,
        stock: validatedData.stock,
        min_stock: validatedData.min_stock ?? 0,
        category: validatedData.category || null,
        location: validatedData.location || null,
        batch_number: validatedData.batch_number || null,
        expiration_date: validatedData.expiration_date || null,
        last_restock_date: editingProduct ? undefined : new Date().toISOString(),
        company_id: currentCompany.id,
      };

      if (editingProduct) {
        updateProductMutation.mutate({ id: editingProduct.id, data: productData });
      } else {
        createProductMutation.mutate(productData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error("Error al validar el producto");
      }
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode || "",
      sku: product.sku || "",
      price: product.price.toString(),
      cost: product.cost?.toString() || "",
      stock: product.stock.toString(),
      min_stock: product.min_stock?.toString() || "",
      category: product.category || "",
      location: product.location || "",
      batch_number: product.batch_number || "",
      expiration_date: product.expiration_date || "",
    });
    setIsDialogOpen(true);
  };

  const toggleProductExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const handleStockAdjust = (product: any) => {
    setAdjustingProduct(product);
    setStockAdjustments({});
    setIsStockAdjustDialogOpen(true);
  };

  const handlePriceListEdit = (product: any) => {
    setPriceListProduct(product);
    setPriceListPrices({});
    setIsPriceListDialogOpen(true);
  };

  const submitPriceListUpdates = async () => {
    if (!priceListProduct) return;

    try {
      for (const [priceListId, priceValue] of Object.entries(priceListPrices)) {
        if (!priceValue) continue;

        const price = parseFloat(priceValue);
        if (isNaN(price) || price < 0) {
          toast.error("Precio inválido");
          continue;
        }

        // Check if price already exists
        const { data: existingPrice } = await supabase
          .from("product_prices")
          .select("id")
          .eq("product_id", priceListProduct.id)
          .eq("price_list_id", priceListId)
          .single();

        if (existingPrice) {
          // Update existing price
          await supabase
            .from("product_prices")
            .update({ price })
            .eq("id", existingPrice.id);
        } else {
          // Insert new price
          await supabase
            .from("product_prices")
            .insert({
              product_id: priceListProduct.id,
              price_list_id: priceListId,
              price,
            });
        }
      }

      toast.success("Precios actualizados exitosamente");
      queryClient.invalidateQueries({ queryKey: ["product-prices"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsPriceListDialogOpen(false);
      setPriceListPrices({});
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar precios");
    }
  };

  const submitStockAdjustments = async () => {
    if (!adjustingProduct) return;

    try {
      for (const [warehouseId, adjustment] of Object.entries(stockAdjustments)) {
        if (!adjustment || parseInt(adjustment) === 0) continue;

        const adjustmentValue = parseInt(adjustment);
        
        // Get current warehouse stock
        const { data: currentStock } = await supabase
          .from("warehouse_stock")
          .select("stock")
          .eq("warehouse_id", warehouseId)
          .eq("product_id", adjustingProduct.id)
          .single();

        if (currentStock) {
          const newStock = currentStock.stock + adjustmentValue;
          if (newStock < 0) {
            toast.error(`Stock insuficiente en depósito ${warehouseId}`);
            continue;
          }

          await supabase
            .from("warehouse_stock")
            .update({ stock: newStock })
            .eq("warehouse_id", warehouseId)
            .eq("product_id", adjustingProduct.id);
        }
      }

      // Recalculate total stock
      const { data: allStocks } = await supabase
        .from("warehouse_stock")
        .select("stock")
        .eq("product_id", adjustingProduct.id);

      const totalStock = allStocks?.reduce((sum, s) => sum + s.stock, 0) || 0;

      await supabase
        .from("products")
        .update({ stock: totalStock })
        .eq("id", adjustingProduct.id);

      toast.success("Stock ajustado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock-detail"] });
      setIsStockAdjustDialogOpen(false);
      setStockAdjustments({});
    } catch (error: any) {
      toast.error(error.message || "Error al ajustar stock");
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && products) {
      setSelectedProducts(new Set(products.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleExportCSV = () => {
    if (!products || products.length === 0) {
      toast.error("No hay productos para exportar");
      return;
    }

    const csvData = products.map(p => {
      const row: any = {
        nombre: p.name,
        categoria: p.category || "",
        codigo_barras: p.barcode || "",
        sku: p.sku || "",
        precio: p.price,
        costo: p.cost || "",
        stock: p.stock,
        stock_minimo: p.min_stock || "",
      };

      // Add warehouse columns if warehouses exist
      if (warehouses) {
        warehouses.forEach(w => {
          row[`deposito_${w.code}`] = 0;
        });
      }

      return row;
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `productos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success("Productos exportados exitosamente");
  };

  const handleImportCSV = () => {
    if (!importFile) {
      toast.error("Selecciona un archivo CSV");
      return;
    }

    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        if (data.length === 0) {
          toast.error("El archivo CSV está vacío");
          return;
        }

        if (data.length > 1000) {
          toast.error("El archivo CSV es demasiado grande (máximo 1000 productos)");
          return;
        }

        for (const row of data) {
          try {
            const nameField = row.nombre?.trim() || row.name?.trim();
            if (!nameField) {
              throw new Error("Falta el campo 'nombre'");
            }

            const validatedData = productSchema.parse({
              name: nameField,
              price: parseFloat(row.precio || row.price),
              cost: row.costo || row.cost ? parseFloat(row.costo || row.cost) : undefined,
              stock: parseInt(row.stock),
              min_stock: row.stock_minimo || row.min_stock ? parseInt(row.stock_minimo || row.min_stock) : undefined,
              category: row.categoria?.trim() || row.category?.trim() || undefined,
              barcode: row.codigo_barras?.trim() || row.barcode?.trim() || undefined,
              sku: row.sku?.trim() || undefined,
            });

            const productData = {
              name: validatedData.name,
              barcode: validatedData.barcode || null,
              sku: validatedData.sku || null,
              price: validatedData.price,
              cost: validatedData.cost ?? 0,
              stock: validatedData.stock,
              min_stock: validatedData.min_stock ?? 0,
              category: validatedData.category || null,
              company_id: currentCompany?.id,
            };

            const { data: product, error } = await supabase
              .from("products")
              .insert(productData)
              .select()
              .single();
            
            if (error) throw error;

            // Handle warehouse distribution if columns exist
            if (warehouses && product) {
              const warehouseStockEntries: any[] = [];
              
              warehouses.forEach(w => {
                const columnName = `deposito_${w.code}`;
                const stockValue = row[columnName];
                
                if (stockValue && parseInt(stockValue) > 0) {
                  warehouseStockEntries.push({
                    warehouse_id: w.id,
                    product_id: product.id,
                    stock: parseInt(stockValue),
                    min_stock: validatedData.min_stock ?? 0,
                  });
                }
              });

              if (warehouseStockEntries.length > 0) {
                // Añadir company_id a cada fila por RLS
                const entriesWithCompany = warehouseStockEntries.map(e => ({ ...e, company_id: currentCompany!.id }));
                await supabase.from("warehouse_stock").insert(entriesWithCompany);
              }
            }

            successCount++;
          } catch (error: any) {
            errorCount++;
            const errorMsg = error instanceof z.ZodError 
              ? error.errors[0].message 
              : error.message || "Error desconocido";
            errors.push(`Fila ${successCount + errorCount}: ${errorMsg}`);
          }
        }

        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
        setIsImportDialogOpen(false);
        setImportFile(null);
        
        if (successCount > 0) {
          toast.success(`${successCount} productos importados exitosamente`);
        }
        if (errorCount > 0) {
          toast.error(`${errorCount} productos no pudieron ser importados. ${errors.slice(0, 3).join(", ")}`);
        }
      },
      error: (error) => {
        toast.error("Error al leer el archivo CSV");
        console.error(error);
      },
    });
  };

  const handleMassEdit = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Selecciona al menos un producto");
      return;
    }

    const updates: any = {};
    if (massEditData.price) updates.price = parseFloat(massEditData.price);
    if (massEditData.cost) updates.cost = parseFloat(massEditData.cost);
    if (massEditData.stock) updates.stock = parseInt(massEditData.stock);
    if (massEditData.category) updates.category = massEditData.category;

    if (Object.keys(updates).length === 0) {
      toast.error("Ingresa al menos un campo para actualizar");
      return;
    }

    try {
      const productIds = Array.from(selectedProducts);
      const { error } = await supabase
        .from("products")
        .update(updates)
        .in("id", productIds);

      if (error) throw error;

      toast.success(`${productIds.length} productos actualizados exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsMassEditDialogOpen(false);
      setMassEditData({ price: "", cost: "", stock: "", category: "" });
      setSelectedProducts(new Set());
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar productos");
    }
  };

  const handleMassDelete = async () => {
    if (selectedProducts.size === 0) {
      toast.error("Selecciona al menos un producto");
      return;
    }

    try {
      const productIds = Array.from(selectedProducts);
      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", productIds);

      if (error) throw error;

      toast.success(`${productIds.length} productos eliminados exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDeleteDialogOpen(false);
      setSelectedProducts(new Set());
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar productos");
    }
  };

  const getWarehouseStockForProduct = (productId: string) => {
    return warehouseStock?.filter(ws => ws.product_id === productId) || [];
  };

  const getStockBadgeColor = (stock: number, minStock: number) => {
    if (stock <= minStock) return "destructive";
    if (stock <= minStock * 1.5) return "secondary";
    return "default";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Productos</h1>
            <p className="text-muted-foreground">Gestiona tu inventario con control de depósitos</p>
          </div>
          <div className="flex gap-2">
            {canExport && (
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            )}
            {canCreate && (
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Importar CSV
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Productos desde CSV</DialogTitle>
                  <DialogDescription>
                    Columnas requeridas: nombre, precio, stock. 
                    {warehouses && warehouses.length > 0 && (
                      <span className="block mt-2">
                        Opcional: {warehouses.map(w => `deposito_${w.code}`).join(", ")}
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="csv-file">Archivo CSV</Label>
                    <Input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleImportCSV} disabled={!importFile}>
                      Importar
                    </Button>
                  </div>
                </div>
            </DialogContent>
          </Dialog>
          )}
          {canCreate && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingProduct(null); resetForm(); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Producto
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoría</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Código de Barras</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Precio *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Costo</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Total *</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_stock">Stock Mínimo</Label>
                    <Input
                      id="min_stock"
                      type="number"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación/Almacén</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Ej: Estante A-3"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batch_number">Número de Lote</Label>
                    <Input
                      id="batch_number"
                      value={formData.batch_number}
                      onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                      placeholder="Ej: LOTE-2025-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration_date">Fecha de Vencimiento</Label>
                    <Input
                      id="expiration_date"
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                    />
                  </div>
                </div>

                {/* Warehouse Distribution Section - Only for new products */}
                {!editingProduct && warehouses && warehouses.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Distribución por Depósito (Opcional)</Label>
                      <p className="text-sm text-muted-foreground">
                        Distribuye el stock total entre los depósitos. Si no distribuyes, el stock quedará sin asignar.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {warehouses.map((warehouse) => (
                          <div key={warehouse.id} className="space-y-2">
                            <Label htmlFor={`warehouse-${warehouse.id}`}>
                              {warehouse.code} - {warehouse.name}
                              {warehouse.is_main && <Badge variant="default" className="ml-2">Principal</Badge>}
                            </Label>
                            <Input
                              id={`warehouse-${warehouse.id}`}
                              type="number"
                              min="0"
                              placeholder="0"
                              value={warehouseStockData["new"]?.[warehouse.id] || ""}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                setWarehouseStockData({
                                  ...warehouseStockData,
                                  new: {
                                    ...warehouseStockData["new"],
                                    [warehouse.id]: value
                                  }
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      {warehouseStockData["new"] && Object.values(warehouseStockData["new"]).some(v => v > 0) && (
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="flex justify-between text-sm">
                            <span>Total distribuido:</span>
                            <span className="font-semibold">
                              {Object.values(warehouseStockData["new"]).reduce((sum, val) => sum + (val || 0), 0)} / {formData.stock || 0}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingProduct ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
          </div>
        </div>

        {selectedProducts.size > 0 && (
          <Card className="shadow-soft bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    {selectedProducts.size} producto{selectedProducts.size > 1 ? 's' : ''} seleccionado{selectedProducts.size > 1 ? 's' : ''}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProducts(new Set())}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpiar selección
                  </Button>
                </div>
                <div className="flex gap-2">
                  {canEdit && (
                    <Dialog open={isMassEditDialogOpen} onOpenChange={setIsMassEditDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Edit className="mr-2 h-4 w-4" />
                          Editar seleccionados
                        </Button>
                      </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edición Masiva</DialogTitle>
                        <DialogDescription>
                          Los campos que completes se aplicarán a los {selectedProducts.size} productos seleccionados
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="mass-price">Precio</Label>
                          <Input
                            id="mass-price"
                            type="number"
                            step="0.01"
                            placeholder="Dejar vacío para no modificar"
                            value={massEditData.price}
                            onChange={(e) => setMassEditData({ ...massEditData, price: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mass-cost">Costo</Label>
                          <Input
                            id="mass-cost"
                            type="number"
                            step="0.01"
                            placeholder="Dejar vacío para no modificar"
                            value={massEditData.cost}
                            onChange={(e) => setMassEditData({ ...massEditData, cost: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mass-stock">Stock</Label>
                          <Input
                            id="mass-stock"
                            type="number"
                            placeholder="Dejar vacío para no modificar"
                            value={massEditData.stock}
                            onChange={(e) => setMassEditData({ ...massEditData, stock: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mass-category">Categoría</Label>
                          <Input
                            id="mass-category"
                            placeholder="Dejar vacío para no modificar"
                            value={massEditData.category}
                            onChange={(e) => setMassEditData({ ...massEditData, category: e.target.value })}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsMassEditDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleMassEdit}>
                            Actualizar {selectedProducts.size} productos
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  )}
                  {canDelete && (
                    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar seleccionados
                        </Button>
                      </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará {selectedProducts.size} producto{selectedProducts.size > 1 ? 's' : ''} y no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMassDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-soft">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={products && products.length > 0 && selectedProducts.size === products.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => {
                  const isExpanded = expandedProducts.has(product.id);
                  const productWarehouseStock = getWarehouseStockForProduct(product.id);
                  
                  return (
                    <>
                      <TableRow key={product.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleProductExpand(product.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.category || "-"}</TableCell>
                        <TableCell>${Number(product.price).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{product.stock}</span>
                            {productWarehouseStock.length > 0 && (
                              <div className="flex gap-1">
                                {productWarehouseStock.slice(0, 3).map((ws: any) => (
                                  <Badge
                                    key={ws.id}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {ws.warehouses.code}: {ws.stock}
                                  </Badge>
                                ))}
                                {productWarehouseStock.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{productWarehouseStock.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStockBadgeColor(product.stock, product.min_stock || 0)}>
                            {product.stock <= (product.min_stock || 0) ? "Stock Bajo" : 
                             product.stock <= (product.min_stock || 0) * 1.5 ? "Stock Medio" : "En Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {canEdit && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleStockAdjust(product)}>
                                <Package className="h-4 w-4 mr-1" />
                                Ajustar
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handlePriceListEdit(product)}>
                                <DollarSign className="h-4 w-4 mr-1" />
                                Precios
                              </Button>
                              <Button size="icon" variant="outline" onClick={() => handleEdit(product)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {canDelete && (
                            <Button size="icon" variant="outline" className="text-destructive" onClick={() => deleteProductMutation.mutate(product.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && productWarehouseStock.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="p-4 space-y-2">
                              <h4 className="font-semibold text-sm">Stock por Depósito</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {productWarehouseStock.map((ws: any) => (
                                  <div key={ws.id} className="flex items-center justify-between p-2 bg-background rounded border">
                                    <div>
                                      <div className="font-medium text-sm">{ws.warehouses.code}</div>
                                      <div className="text-xs text-muted-foreground">{ws.warehouses.name}</div>
                                    </div>
                                    <Badge variant={getStockBadgeColor(ws.stock, ws.min_stock)}>
                                      {ws.stock}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Stock Adjustment Dialog */}
        <Dialog open={isStockAdjustDialogOpen} onOpenChange={setIsStockAdjustDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajustar Stock por Depósito</DialogTitle>
              <DialogDescription>
                {adjustingProduct?.name} - Stock Total: {adjustingProduct?.stock}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ingresa valores positivos para agregar o negativos para restar stock de cada depósito.
              </p>
              {warehouses?.map((warehouse) => {
                const warehouseStock = getWarehouseStockForProduct(adjustingProduct?.id || "")
                  .find((ws: any) => ws.warehouse_id === warehouse.id);
                
                return (
                  <div key={warehouse.id} className="space-y-2">
                    <Label>
                      {warehouse.code} - {warehouse.name}
                      {warehouseStock && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          (Actual: {warehouseStock.stock})
                        </span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={stockAdjustments[warehouse.id] || ""}
                      onChange={(e) => setStockAdjustments({
                        ...stockAdjustments,
                        [warehouse.id]: e.target.value
                      })}
                    />
                  </div>
                );
              })}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsStockAdjustDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={submitStockAdjustments}>
                  Aplicar Ajustes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Precios por Lista */}
        <Dialog open={isPriceListDialogOpen} onOpenChange={setIsPriceListDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Precios por Lista - {priceListProduct?.name}</DialogTitle>
              <DialogDescription>
                Define precios específicos para cada lista de precios. El precio base del producto es ${priceListProduct?.price}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-medium mb-2">Precio Base (por defecto)</p>
                <p className="text-2xl font-bold">${priceListProduct?.price}</p>
              </div>

              {priceLists && priceLists.length > 0 ? (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Precios por Lista</Label>
                  {priceLists.map((priceList: any) => {
                    const existingPrice = productPrices?.find((pp: any) => pp.price_list_id === priceList.id);
                    return (
                      <div key={priceList.id} className="space-y-2">
                        <Label className="flex items-center gap-2">
                          {priceList.name}
                          {priceList.is_default && <Badge variant="secondary">Por defecto</Badge>}
                          {existingPrice && (
                            <span className="text-sm text-muted-foreground">
                              (Actual: ${existingPrice.price})
                            </span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={existingPrice ? String(existingPrice.price) : "Precio en esta lista"}
                          value={priceListPrices[priceList.id] || ""}
                          onChange={(e) => setPriceListPrices({
                            ...priceListPrices,
                            [priceList.id]: e.target.value
                          })}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay listas de precios configuradas</p>
                  <p className="text-sm">Crea listas de precios en Configuración</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setIsPriceListDialogOpen(false);
                  setPriceListPrices({});
                }}>
                  Cancelar
                </Button>
                <Button onClick={submitPriceListUpdates}>
                  Guardar Precios
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
