import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeSearchQuery } from "@/lib/searchUtils";
import { Plus, Edit, Trash2, Search, Upload, Download, X, Package, ChevronDown, ChevronRight, DollarSign, AlertCircle, CheckCircle2, Info, Image as ImageIcon, BarChart3, ShoppingCart, PackageOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { compressImage, isValidImage, formatFileSize } from "@/lib/imageUtils";
import { ComboComponentsDialog } from "@/components/products/ComboComponentsDialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/useDebounce";
import { useServerPagination } from "@/hooks/useServerPagination";

const productSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(200, "El nombre debe tener máximo 200 caracteres"),
  price: z.number({ invalid_type_error: "El precio debe ser un número" })
    .positive("El precio debe ser mayor a 0")
    .max(9999999999.99, "El precio debe ser menor a 10,000,000,000"),
  cost: z.number({ invalid_type_error: "El costo debe ser un número" })
    .nonnegative("El costo no puede ser negativo")
    .max(9999999999.99, "El costo debe ser menor a 10,000,000,000")
    .optional(),
  stock: z.number({ invalid_type_error: "El stock debe ser un número" })
    .int("El stock debe ser un número entero")
    .nonnegative("El stock no puede ser negativo")
    .max(10000000, "El stock debe ser menor a 10,000,000"),
  min_stock: z.number({ invalid_type_error: "El stock mínimo debe ser un número" })
    .int("El stock mínimo debe ser un número entero")
    .nonnegative("El stock mínimo no puede ser negativo")
    .max(10000000, "El stock mínimo debe ser menor a 10,000,000")
    .optional(),
  category: z.string().max(100, "La categoría debe tener máximo 100 caracteres").optional(),
  barcode: z.string().max(50, "El código de barras debe tener máximo 50 caracteres").optional(),
  sku: z.string().max(50, "El SKU debe tener máximo 50 caracteres").optional(),
  location: z.string().max(100, "La ubicación debe tener máximo 100 caracteres").optional(),
  batch_number: z.string().max(50, "El número de lote debe tener máximo 50 caracteres").optional(),
  expiration_date: z.string().optional(),
});

export default function Products() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canCreate = hasPermission('products', 'create');
  const canEdit = hasPermission('products', 'edit');
  const canDelete = hasPermission('products', 'delete');
  const canExport = hasPermission('products', 'export');
  const canView = hasPermission('products', 'view');

  // Verificar que el usuario tenga acceso a la empresa actual
  useEffect(() => {
    if (!permissionsLoading && currentCompany && !hasPermission('products', 'view')) {
      toast.error("No tienes acceso a los productos de esta empresa");
    }
  }, [currentCompany, permissionsLoading, hasPermission, canCreate, canEdit, canDelete, canExport]);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  
  // Cargar parámetro de búsqueda desde URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, []);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  // Reset form when dialog opens for new product
  useEffect(() => {
    if (isDialogOpen && !editingProduct) {
      resetForm();
    }
  }, [isDialogOpen, editingProduct]);
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
    is_combo: false,
    currency: "ARS",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [compressingImage, setCompressingImage] = useState(false);
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
  const [isCurrencyAdjustDialogOpen, setIsCurrencyAdjustDialogOpen] = useState(false);
  const [adjustmentCurrency, setAdjustmentCurrency] = useState<string>('USD');
  const [adjustmentPercentage, setAdjustmentPercentage] = useState<string>('');
  const [previewAdjustments, setPreviewAdjustments] = useState<any[]>([]);
  const [isApplyingAdjustments, setIsApplyingAdjustments] = useState(false);

  // Función para convertir precio a ARS
  const convertToARS = (price: number, currency: string) => {
    if (!currency || currency === 'ARS') return price;
    const rate = exchangeRates?.find(r => r.currency === currency);
    if (!rate) return null;
    return price * rate.rate;
  };
  const [isComboDialogOpen, setIsComboDialogOpen] = useState(false);
  const [comboProduct, setComboProduct] = useState<any>(null);
  const queryClient = useQueryClient();
  
  // Server-side pagination
  const pagination = useServerPagination({ pageSize: 50 });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", debouncedSearch, categoryFilter, currentCompany?.id, pagination.currentPage],
    queryFn: async () => {
      if (!currentCompany?.id) return { data: [], count: 0 };
      
      let query = supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      
      if (debouncedSearch) {
        const sanitized = sanitizeSearchQuery(debouncedSearch);
        if (sanitized) {
          query = query.or(`name.ilike.%${sanitized}%,barcode.ilike.%${sanitized}%,sku.ilike.%${sanitized}%`);
        }
      }
      
      if (categoryFilter) {
        query = query.eq("category", categoryFilter);
      }
      
      // Apply pagination
      query = query.range(pagination.from, pagination.to);
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!currentCompany?.id,
  });
  
  const products = productsData?.data || [];
  const totalCount = productsData?.count || 0;

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
        .select("id, name, is_default, company_id")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("name");
      
      if (error) {
        console.error('Error loading price lists:', error);
        throw error;
      }
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const { data: exchangeRates } = useQuery({
    queryKey: ["exchange-rates", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("company_id", currentCompany.id);
      
      if (error) {
        console.error('Error loading exchange rates:', error);
        return [];
      }
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
        .select("*, price_lists(name, company_id)")
        .eq("product_id", priceListProduct.id);
      
      if (error) {
        console.error('Error loading product prices:', error);
        throw error;
      }
      return data;
    },
    enabled: !!priceListProduct?.id,
  });

  const uploadProductImage = async (file: File, productId: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');
    
    // Compress image before upload (optimized for faster loading)
    const compressedBlob = await compressImage(file, {
      maxWidth: 600,
      maxHeight: 600,
      quality: 0.65,
      outputFormat: 'image/webp'
    });
    
    const originalSize = formatFileSize(file.size);
    const compressedSize = formatFileSize(compressedBlob.size);
    
    // Generate unique filename
    const fileExt = 'webp';
    const fileName = `${user.id}/${productId}_${Date.now()}.${fileExt}`;
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, compressedBlob, {
        contentType: 'image/webp',
        upsert: true
      });
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!currentCompany?.id) throw new Error('Empresa no seleccionada');
      if (!canCreate) throw new Error('No tienes permiso para crear productos en esta empresa');
      
      // Forzar company_id correcto
      const payload = { ...data, company_id: currentCompany.id };
      const { data: product, error } = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();
      
      if (error) throw error;
      
      // Upload image if provided
      if (imageFile) {
        try {
          setUploadingImage(true);
          const imageUrl = await uploadProductImage(imageFile, product.id);
          
          // Update product with image URL
          const { error: updateError } = await supabase
            .from("products")
            .update({ image_url: imageUrl })
            .eq("id", product.id);
          
          if (updateError) throw updateError;
          product.image_url = imageUrl;
        } catch (imgError) {
          console.error('Error uploading image:', imgError);
          toast.error('Producto creado pero falló la subida de imagen');
        } finally {
          setUploadingImage(false);
        }
      }
      
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
      if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('policy')) {
        toast.error("No tienes permisos para crear productos en esta empresa.");
        console.error('RLS error creating product', { currentCompany, canCreate, error });
      } else if (msg.includes('No tienes permiso') || msg.includes('Empresa no seleccionada')) {
        toast.error(msg);
      } else {
        toast.error(error.message || "Error al crear producto");
      }
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      if (!currentCompany?.id) throw new Error('Empresa no seleccionada');
      if (!canEdit) throw new Error('No tienes permiso para editar productos en esta empresa');
      
      // Upload new image if provided
      if (imageFile) {
        try {
          setUploadingImage(true);
          const imageUrl = await uploadProductImage(imageFile, id);
          data.image_url = imageUrl;
        } catch (imgError) {
          console.error('Error uploading image:', imgError);
          toast.error('Error al subir la imagen');
        } finally {
          setUploadingImage(false);
        }
      }
      
      const { error } = await supabase
        .from("products")
        .update(data)
        .eq("id", id)
        .eq("company_id", currentCompany.id);
      
      if (error) throw error;
      
      // Update warehouse stock if provided
      if (warehouses && warehouseStockData[id] && Object.keys(warehouseStockData[id]).length > 0) {
        for (const [warehouseId, stock] of Object.entries(warehouseStockData[id])) {
          // Check if warehouse stock entry exists
          const { data: existingStock } = await supabase
            .from("warehouse_stock")
            .select("id")
            .eq("warehouse_id", warehouseId)
            .eq("product_id", id)
            .single();
          
          if (existingStock) {
            // Update existing entry
            await supabase
              .from("warehouse_stock")
              .update({ stock: stock || 0 })
              .eq("id", existingStock.id);
          } else if (stock > 0) {
            // Create new entry only if stock > 0
            await supabase
              .from("warehouse_stock")
              .insert({
                warehouse_id: warehouseId,
                product_id: id,
                stock: stock || 0,
                min_stock: data.min_stock || 0,
                company_id: currentCompany.id,
              });
          }
        }
        
        // Recalculate total stock
        const { data: allStocks } = await supabase
          .from("warehouse_stock")
          .select("stock")
          .eq("product_id", id);
        
        const totalStock = allStocks?.reduce((sum, s) => sum + s.stock, 0) || 0;
        
        await supabase
          .from("products")
          .update({ stock: totalStock })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success("Producto actualizado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock-detail"] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      resetForm();
      setWarehouseStockData({});
    },
    onError: (error: any) => {
      const msg = error?.message || '';
      if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('policy')) {
        toast.error("No tienes permisos para editar productos en esta empresa.");
        console.error('RLS error updating product', { currentCompany, canEdit, error });
      } else if (msg.includes('No tienes permiso') || msg.includes('Empresa no seleccionada')) {
        toast.error(msg);
      } else {
        toast.error(error.message || "Error al actualizar producto");
      }
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!currentCompany?.id) throw new Error('Empresa no seleccionada');
      if (!canDelete) throw new Error('No tienes permiso para eliminar productos en esta empresa');
      
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)
        .eq("company_id", currentCompany.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Producto eliminado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      const msg = error?.message || '';
      if (msg.includes('row-level security') || msg.includes('RLS') || msg.includes('policy')) {
        toast.error("No tienes permisos para eliminar productos en esta empresa.");
        console.error('RLS error deleting product', { currentCompany, canDelete, error });
      } else if (msg.includes('No tienes permiso') || msg.includes('Empresa no seleccionada')) {
        toast.error(msg);
      } else {
        toast.error(error.message || "Error al eliminar producto");
      }
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
      is_combo: false,
      currency: "ARS",
    });
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!currentCompany?.id) {
        console.error('No hay empresa seleccionada');
        toast.error("No hay empresa seleccionada. Selecciona una empresa antes de crear productos.");
        return;
      }
      
      // Validate required fields
      if (!formData.name || !formData.price || !formData.stock) {
        console.error('Faltan campos requeridos:', { name: formData.name, price: formData.price, stock: formData.stock });
        toast.error("Por favor completa todos los campos requeridos: Nombre, Precio y Stock");
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
        stock_physical: validatedData.stock,
        stock_reserved: 0,
        min_stock: validatedData.min_stock ?? 0,
        category: validatedData.category || null,
        location: validatedData.location || null,
        batch_number: validatedData.batch_number || null,
        expiration_date: validatedData.expiration_date || null,
        is_combo: formData.is_combo,
        currency: formData.currency || 'ARS',
        last_restock_date: editingProduct ? undefined : new Date().toISOString(),
        company_id: currentCompany.id,
      };

      if (editingProduct) {
        updateProductMutation.mutate({ id: editingProduct.id, data: productData });
      } else {
        createProductMutation.mutate(productData);
      }
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        console.error('Error de validación Zod:', firstError);
        toast.error(firstError.message);
      } else {
        toast.error("Error al validar el producto");
      }
    }
  };

  const handleEdit = async (product: any) => {
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
      is_combo: product.is_combo || false,
      currency: product.currency || "ARS",
    });
    setImagePreview(product.image_url || "");
    setImageFile(null);
    
    // Load warehouse stock data for this product
    if (warehouses) {
      const { data: warehouseStockData } = await supabase
        .from("warehouse_stock")
        .select("warehouse_id, stock")
        .eq("product_id", product.id);
      
      const stockByWarehouse: Record<string, number> = {};
      warehouseStockData?.forEach(ws => {
        stockByWarehouse[ws.warehouse_id] = ws.stock;
      });
      
      setWarehouseStockData({
        [product.id]: stockByWarehouse
      });
    }
    
    setIsDialogOpen(true);
  };
  
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!isValidImage(file)) {
      toast.error('Por favor selecciona una imagen válida (JPG, PNG o WebP)');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 10MB');
      return;
    }
    
    setCompressingImage(true);
    
    try {
      // Show preview of original image immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      setImageFile(file);
      toast.success(`Imagen cargada (${formatFileSize(file.size)}). Se comprimirá al guardar.`);
    } catch (error) {
      console.error('Error loading image:', error);
      toast.error('Error al cargar la imagen');
    } finally {
      setCompressingImage(false);
    }
  };
  
  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    // Reset file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
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

  const handleStockAdjust = async (product: any) => {
    setAdjustingProduct(product);
    
    // Load current warehouse stock values
    if (warehouses) {
      const { data: warehouseStockData } = await supabase
        .from("warehouse_stock")
        .select("warehouse_id, stock")
        .eq("product_id", product.id);
      
      const initialStockValues: Record<string, string> = {};
      warehouses.forEach(warehouse => {
        const stockEntry = warehouseStockData?.find(ws => ws.warehouse_id === warehouse.id);
        initialStockValues[warehouse.id] = stockEntry ? stockEntry.stock.toString() : '0';
      });
      
      setStockAdjustments(initialStockValues);
    } else {
      setStockAdjustments({});
    }
    
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
      for (const [warehouseId, newStockValue] of Object.entries(stockAdjustments)) {
        if (newStockValue === '' || newStockValue === undefined) continue;

        const newStock = parseInt(newStockValue);
        
        if (isNaN(newStock) || newStock < 0) {
          toast.error(`Valor de stock inválido para depósito ${warehouseId}`);
          continue;
        }

        // Check if warehouse stock entry exists
        const { data: existingStock } = await supabase
          .from("warehouse_stock")
          .select("id")
          .eq("warehouse_id", warehouseId)
          .eq("product_id", adjustingProduct.id)
          .single();

        if (existingStock) {
          // Update existing stock
          await supabase
            .from("warehouse_stock")
            .update({ stock: newStock })
            .eq("warehouse_id", warehouseId)
            .eq("product_id", adjustingProduct.id);
        } else {
          // Create new warehouse stock entry
          await supabase
            .from("warehouse_stock")
            .insert({
              warehouse_id: warehouseId,
              product_id: adjustingProduct.id,
              stock: newStock,
              min_stock: adjustingProduct.min_stock || 0,
              company_id: currentCompany?.id,
            });
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

  const calculatePriceAdjustmentPreview = () => {
    if (!adjustmentPercentage || !products) {
      toast.error("Ingresa un porcentaje de ajuste");
      return;
    }

    const percentage = parseFloat(adjustmentPercentage);
    if (isNaN(percentage)) {
      toast.error("Porcentaje inválido");
      return;
    }

    const productsToAdjust = products.filter((p: any) => {
      const currency = p.currency || 'ARS';
      return currency === adjustmentCurrency;
    });

    if (productsToAdjust.length === 0) {
      toast.error(`No hay productos en ${adjustmentCurrency}`);
      setPreviewAdjustments([]);
      return;
    }

    const previews = productsToAdjust.map((product: any) => {
      const currentPrice = Number(product.price);
      const newPrice = currentPrice * (1 + percentage / 100);
      const currency = product.currency || 'ARS';
      const currentARS = convertToARS(currentPrice, currency);
      const newARS = convertToARS(newPrice, currency);

      return {
        id: product.id,
        name: product.name,
        currentPrice,
        newPrice,
        currentARS,
        newARS,
        difference: newPrice - currentPrice,
      };
    });

    setPreviewAdjustments(previews);
    toast.success(`${previews.length} productos listos para ajustar`);
  };

  const applyPriceAdjustments = async () => {
    if (previewAdjustments.length === 0) {
      toast.error("No hay ajustes para aplicar");
      return;
    }

    setIsApplyingAdjustments(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      for (const adjustment of previewAdjustments) {
        const { error } = await supabase
          .from("products")
          .update({ 
            price: adjustment.newPrice,
            updated_at: new Date().toISOString()
          })
          .eq("id", adjustment.id)
          .eq("company_id", currentCompany?.id);

        if (error) {
          console.error(`Error actualizando producto ${adjustment.name}:`, error);
          errors.push(`${adjustment.name}: ${error.message}`);
          errorCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`✅ ${successCount} de ${previewAdjustments.length} precios actualizados`);
      }
      if (errorCount > 0) {
        console.error("Errores detallados:", errors);
        toast.error(`❌ ${errorCount} productos no pudieron actualizarse. Revisa la consola.`);
      }
      
      queryClient.invalidateQueries({ queryKey: ["products"] });
      
      if (errorCount === 0) {
        setIsCurrencyAdjustDialogOpen(false);
        setPreviewAdjustments([]);
        setAdjustmentPercentage('');
      }
    } catch (error: any) {
      console.error("Error en applyPriceAdjustments:", error);
      toast.error(error.message || "Error al ajustar precios");
    } finally {
      setIsApplyingAdjustments(false);
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
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-foreground">Productos</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Gestiona tu inventario</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/reports?tab=products")}>
              <BarChart3 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Ver Reportes</span>
            </Button>
            {canEdit && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsCurrencyAdjustDialogOpen(true)}
                className="border-blue-500/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                <DollarSign className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Ajustar Cotización</span>
              </Button>
            )}
            {canExport && (
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </Button>
            )}
            {canCreate && (
              <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Importar CSV</span>
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
                <Button size="sm" className="gap-1 sm:gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Agregar Producto</span>
                  <span className="sm:hidden">Agregar</span>
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {editingProduct ? "Editar Producto" : "Agregar Nuevo Producto"}
                </DialogTitle>
                <DialogDescription>
                  {editingProduct 
                    ? "Modifica los detalles del producto existente" 
                    : "Completa la información básica del producto. Los campos con * son obligatorios"}
                </DialogDescription>
              </DialogHeader>
              <form 
                onSubmit={handleSubmit} 
                className="space-y-6"
                aria-label={editingProduct ? "Formulario de edición de producto" : "Formulario de nuevo producto"}
              >
                {/* Información Básica */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Info className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold">
                      Información Básica
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-1">
                        Nombre del Producto <span className="text-destructive">*</span>
                      </Label>
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
                      placeholder="Ej: Electrónica, Alimentos, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Código de Barras</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="Escanea o ingresa manualmente"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU (Código Interno)</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="Código único del producto"
                    />
                  </div>
                  </div>
                  
                  {/* Imagen del Producto */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Imagen del Producto
                    </Label>
                    <div className="flex items-center gap-4">
                      {imagePreview && (
                        <div className="relative w-24 h-24 border rounded-lg overflow-hidden">
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={removeImage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleImageSelect}
                          className="cursor-pointer"
                          disabled={compressingImage || uploadingImage}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {compressingImage ? (
                            <span className="text-primary">⏳ Procesando imagen...</span>
                          ) : uploadingImage ? (
                            <span className="text-primary">⏳ Subiendo imagen...</span>
                          ) : (
                            <>Formatos: JPG, PNG, WebP. Máx: 10MB. Se comprimirá automáticamente.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Precios y Stock */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-500" />
                    </div>
                    <h3 className="text-sm font-semibold">
                      Precios y Stock
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="flex items-center gap-1">
                      Precio de Venta <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Costo (Opcional)</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Moneda</Label>
                    <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ARS">🇦🇷 ARS (Peso Argentino)</SelectItem>
                        <SelectItem value="USD">🇺🇸 USD (Dólar)</SelectItem>
                        <SelectItem value="EUR">🇪🇺 EUR (Euro)</SelectItem>
                        <SelectItem value="BRL">🇧🇷 BRL (Real)</SelectItem>
                        <SelectItem value="CLP">🇨🇱 CLP (Peso Chileno)</SelectItem>
                        <SelectItem value="UYU">🇺🇾 UYU (Peso Uruguayo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock" className="flex items-center gap-1">
                      Cantidad en Stock <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_stock">Stock Mínimo (Alerta)</Label>
                    <Input
                      id="min_stock"
                      type="number"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  </div>
                </div>

                {/* Producto Combo */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <PackageOpen className="h-4 w-4 text-purple-600 dark:text-purple-500" />
                    </div>
                    <h3 className="text-sm font-semibold">
                      Producto Combo/Mix
                    </h3>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label htmlFor="is_combo" className="text-sm font-medium cursor-pointer">
                        Este producto es un combo
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Un combo está compuesto por otros productos. Al venderlo, se descontará el stock de sus componentes.
                      </p>
                    </div>
                    <Switch
                      id="is_combo"
                      checked={formData.is_combo}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_combo: checked })}
                    />
                  </div>
                  {formData.is_combo && editingProduct && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Para gestionar los componentes de este combo, guarda el producto y usa el botón "Gestionar Componentes" en la tabla.
                      </p>
                    </div>
                  )}
                </div>

                {/* Información Adicional */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Package className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                    </div>
                    <h3 className="text-sm font-semibold">
                      Información Adicional <span className="text-xs text-muted-foreground font-normal">(Opcional)</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                </div>

                {/* Warehouse Distribution Section */}
                {warehouses && warehouses.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-base font-semibold">
                        {editingProduct ? "Gestionar Stock por Depósito" : "Distribución por Depósito (Opcional)"}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {editingProduct 
                          ? "Asigna o modifica el stock de este producto en cada depósito. El stock total se calculará automáticamente."
                          : "Distribuye el stock total entre los depósitos. Si no distribuyes, el stock quedará sin asignar."}
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {warehouses.map((warehouse) => {
                          const existingStock = editingProduct 
                            ? warehouseStockData[editingProduct.id]?.[warehouse.id]
                            : warehouseStockData["new"]?.[warehouse.id];
                          
                          return (
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
                                value={editingProduct 
                                  ? (warehouseStockData[editingProduct.id]?.[warehouse.id] ?? existingStock ?? "")
                                  : (warehouseStockData["new"]?.[warehouse.id] || "")}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  const productKey = editingProduct ? editingProduct.id : "new";
                                  setWarehouseStockData({
                                    ...warehouseStockData,
                                    [productKey]: {
                                      ...warehouseStockData[productKey],
                                      [warehouse.id]: value
                                    }
                                  });
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {editingProduct ? (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            💡 Al editar, puedes usar el botón de "Ajustar Stock" para modificaciones rápidas del stock actual.
                          </p>
                        </div>
                      ) : (
                        warehouseStockData["new"] && Object.values(warehouseStockData["new"]).some(v => v > 0) && (
                          <div className="p-3 bg-muted rounded-lg">
                            <div className="flex justify-between text-sm">
                              <span>Total distribuido:</span>
                              <span className="font-semibold">
                                {Object.values(warehouseStockData["new"]).reduce((sum, val) => sum + (val || 0), 0)} / {formData.stock || 0}
                              </span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    disabled={uploadingImage || compressingImage}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="gap-2"
                    disabled={uploadingImage || compressingImage}
                  >
                    {uploadingImage ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Subiendo imagen...
                      </>
                    ) : editingProduct ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Actualizar Producto
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Crear Producto
                      </>
                    )}
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
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter || "ALL"} onValueChange={(value) => setCategoryFilter(value === "ALL" ? "" : value)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las categorías</SelectItem>
                  {products && Array.from(new Set(products.filter(p => p.category).map(p => p.category))).sort().map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 sm:w-12" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={products && products.length > 0 && selectedProducts.size === products.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-8 sm:w-12 hidden sm:table-cell"></TableHead>
                  <TableHead className="min-w-[120px]">Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Categoría</TableHead>
                  <TableHead className="min-w-[80px]">Precio</TableHead>
                  <TableHead className="hidden sm:table-cell">Stock</TableHead>
                  <TableHead className="hidden lg:table-cell">Estado</TableHead>
                  <TableHead className="text-right min-w-[80px]">Acc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => {
                  const isExpanded = expandedProducts.has(product.id);
                  const productWarehouseStock = getWarehouseStockForProduct(product.id);
                  
                  return (
                    <React.Fragment key={product.id}>
                      <TableRow>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); toggleProductExpand(product.id); }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded border"
                              />
                            ) : (
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-muted rounded border flex items-center justify-center">
                                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <span className="font-medium text-xs sm:text-sm truncate">{product.name}</span>
                                {product.is_combo && (
                                  <Badge variant="outline" className="text-xs gap-1 hidden sm:flex">
                                    <PackageOpen className="h-3 w-3" />
                                    Combo
                                  </Badge>
                                )}
                              </div>
                              {product.sku && (
                                <span className="text-xs text-muted-foreground hidden sm:block">SKU: {product.sku}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-muted-foreground text-xs sm:text-sm">{product.category || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-green-600 dark:text-green-500 text-xs sm:text-sm">
                              ${Number(product.price).toFixed(0)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={`font-semibold text-xs sm:text-sm ${
                            product.stock <= (product.min_stock || 0) 
                              ? 'text-red-600 dark:text-red-500' 
                              : product.stock <= (product.min_stock || 0) * 1.5
                              ? 'text-yellow-600 dark:text-yellow-500'
                              : 'text-green-600 dark:text-green-500'
                          }`}>
                            {product.stock}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {product.stock <= (product.min_stock || 0) ? (
                            <Badge variant="destructive" className="flex items-center gap-1 w-fit text-xs">
                              <AlertCircle className="h-3 w-3" />
                              Bajo
                            </Badge>
                          ) : product.stock <= (product.min_stock || 0) * 1.5 ? (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit text-xs">
                              <Info className="h-3 w-3" />
                              Medio
                            </Badge>
                          ) : (
                            <Badge variant="default" className="flex items-center gap-1 w-fit bg-green-600 hover:bg-green-700 text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      navigate(`/sales?product=${product.id}`);
                                    }}
                                  >
                                    <BarChart3 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver ventas del producto</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      navigate(`/purchases?product=${product.id}`);
                                    }}
                                  >
                                    <ShoppingCart className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Crear orden de compra</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          {canEdit && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleStockAdjust(product); }}>
                                      <Package className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ajustar stock</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handlePriceListEdit(product); }}>
                                      <DollarSign className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Listas de precios</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              {product.is_combo && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setComboProduct(product);
                                          setIsComboDialogOpen(true);
                                        }}
                                      >
                                        <PackageOpen className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Gestionar componentes</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(product); }}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar producto</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                          {canDelete && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); deleteProductMutation.mutate(product.id); }}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Eliminar producto</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          </div>
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
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          
          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {pagination.getPageInfo(totalCount).start} - {pagination.getPageInfo(totalCount).end} de {totalCount} productos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pagination.goToPreviousPage}
                  disabled={!pagination.canGoPrevious}
                  aria-label="Página anterior"
                >
                  Anterior
                </Button>
                <span className="text-sm">
                  Página {pagination.currentPage} de {pagination.getTotalPages(totalCount)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pagination.goToNextPage}
                  disabled={!pagination.canGoNext(totalCount)}
                  aria-label="Página siguiente"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
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
                Modifica el stock de cada depósito. Ingresa el valor final deseado para cada ubicación.
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

        {/* Combo Components Dialog */}
        {comboProduct && (
          <ComboComponentsDialog
            productId={comboProduct.id}
            productName={comboProduct.name}
            isOpen={isComboDialogOpen}
            onClose={() => {
              setIsComboDialogOpen(false);
              setComboProduct(null);
            }}
          />
        )}

        {/* Currency Adjustment Dialog */}
        <Dialog open={isCurrencyAdjustDialogOpen} onOpenChange={setIsCurrencyAdjustDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                Ajuste Masivo por Cotización
              </DialogTitle>
              <DialogDescription>
                Actualiza los precios en ARS de productos en moneda extranjera basándote en la nueva cotización
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Moneda a Ajustar</Label>
                  <Select value={adjustmentCurrency} onValueChange={setAdjustmentCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">🇺🇸 USD (Dólar)</SelectItem>
                      <SelectItem value="EUR">🇪🇺 EUR (Euro)</SelectItem>
                      <SelectItem value="BRL">🇧🇷 BRL (Real)</SelectItem>
                      <SelectItem value="CLP">🇨🇱 CLP (Peso Chileno)</SelectItem>
                      <SelectItem value="UYU">🇺🇾 UYU (Peso Uruguayo)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Productos afectados: {products?.filter((p: any) => p.currency === adjustmentCurrency).length || 0}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adjustment-percentage">Porcentaje de Ajuste</Label>
                  <div className="flex gap-2">
                    <Input
                      id="adjustment-percentage"
                      type="number"
                      step="0.1"
                      placeholder="Ej: 10 para subir 10%"
                      value={adjustmentPercentage}
                      onChange={(e) => {
                        setAdjustmentPercentage(e.target.value);
                      }}
                      className="flex-1"
                      autoComplete="off"
                    />
                    <Button onClick={calculatePriceAdjustmentPreview} variant="outline">
                      <Search className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use números negativos para bajar precios (ej: -5 para bajar 5%)
                  </p>
                </div>
              </div>

              {/* Current Exchange Rate */}
              {exchangeRates && (
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Cotización Actual:</span>
                    <span className="text-lg font-bold">
                      1 {adjustmentCurrency} = {exchangeRates.find(r => r.currency === adjustmentCurrency)?.rate?.toFixed(2) || 'N/A'} ARS
                    </span>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {previewAdjustments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Vista Previa de Cambios</Label>
                    <Badge variant="secondary">{previewAdjustments.length} productos</Badge>
                  </div>
                  
                  <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Precio Actual</TableHead>
                          <TableHead className="text-right">Precio Nuevo</TableHead>
                          <TableHead className="text-right">En ARS Actual</TableHead>
                          <TableHead className="text-right">En ARS Nuevo</TableHead>
                          <TableHead className="text-right">Diferencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewAdjustments.map((adj) => (
                          <TableRow key={adj.id}>
                            <TableCell className="font-medium">{adj.name}</TableCell>
                            <TableCell className="text-right">
                              {adjustmentCurrency} ${adj.currentPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-600">
                              {adjustmentCurrency} ${adj.newPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {adj.currentARS ? `ARS $${adj.currentARS.toFixed(2)}` : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {adj.newARS ? `ARS $${adj.newARS.toFixed(2)}` : 'N/A'}
                            </TableCell>
                            <TableCell className={`text-right font-bold ${adj.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {adj.difference >= 0 ? '+' : ''}{adjustmentCurrency} ${adj.difference.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setPreviewAdjustments([]);
                        setAdjustmentPercentage('');
                      }}
                      disabled={isApplyingAdjustments}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={applyPriceAdjustments} 
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={isApplyingAdjustments}
                    >
                      {isApplyingAdjustments ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Aplicando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Aplicar Cambios
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {previewAdjustments.length === 0 && adjustmentPercentage && (
                <div className="text-center text-muted-foreground py-8">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Haz clic en "Preview" para ver los cambios antes de aplicarlos</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
