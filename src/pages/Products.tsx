import { useState } from "react";
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
import { Plus, Edit, Trash2, Search, Upload, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import Papa from "papaparse";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePermissions";

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
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('products', 'create');
  const canEdit = hasPermission('products', 'edit');
  const canDelete = hasPermission('products', 'delete');
  const canExport = hasPermission('products', 'export');

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
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", searchQuery],
    queryFn: async () => {
      let query = supabase.from("products").select("*").order("created_at", { ascending: false });
      
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
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("products").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Producto creado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear producto");
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
      // Parse and validate input data
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

      // Prepare data for database
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

    const csvData = products.map(p => ({
      nombre: p.name,
      categoria: p.category || "",
      codigo_barras: p.barcode || "",
      sku: p.sku || "",
      precio: p.price,
      costo: p.cost || "",
      stock: p.stock,
      stock_minimo: p.min_stock || "",
    }));

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

        // Validate file has data
        if (data.length === 0) {
          toast.error("El archivo CSV está vacío");
          return;
        }

        // Validate file size (max 1000 rows)
        if (data.length > 1000) {
          toast.error("El archivo CSV es demasiado grande (máximo 1000 productos)");
          return;
        }

        for (const row of data) {
          try {
            // Validate required fields exist
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
            };

            const { error } = await supabase.from("products").insert(productData);
            if (error) throw error;
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Productos</h1>
            <p className="text-muted-foreground">Gestiona tu inventario</p>
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
                    El archivo debe contener las columnas: nombre, categoria, codigo_barras, sku, precio, costo, stock, stock_minimo
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
            <DialogContent className="max-w-2xl">
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
                    <Label htmlFor="stock">Stock *</Label>
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
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category || "-"}</TableCell>
                    <TableCell>${Number(product.price).toFixed(2)}</TableCell>
                    <TableCell>{product.stock}</TableCell>
                    <TableCell>
                      {product.stock <= (product.min_stock || 0) ? (
                        <Badge variant="destructive">Stock Bajo</Badge>
                      ) : (
                        <Badge variant="default" className="bg-success">En Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {canEdit && (
                        <Button size="icon" variant="outline" onClick={() => handleEdit(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="icon" variant="outline" className="text-destructive" onClick={() => deleteProductMutation.mutate(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
