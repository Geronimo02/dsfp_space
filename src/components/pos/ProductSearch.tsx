import { useState, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  sku?: string;
  image_url?: string;
}

interface ProductSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  products: Product[];
  isLoading: boolean;
  onAddToCart: (product: Product) => void;
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export function ProductSearch({
  searchQuery,
  onSearchChange,
  products,
  isLoading,
  onAddToCart,
  searchInputRef,
}: ProductSearchProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar por nombre, código o escanear..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
            aria-label="Buscar productos"
            autoComplete="off"
          />
        </div>

        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto"
          role="region"
          aria-label="Lista de productos"
          aria-live="polite"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className="col-span-full text-center py-8 text-muted-foreground" role="status">
              Cargando productos...
            </div>
          ) : products.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground" role="status">
              {searchQuery ? "No se encontraron productos" : "Busca productos para comenzar"}
            </div>
          ) : (
            products.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onAddToCart(product)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAddToCart(product);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Agregar ${product.name} al carrito. Precio: $${product.price.toFixed(2)}. Stock: ${product.stock}`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
                    {product.stock <= 5 && product.stock > 0 && (
                      <Badge variant="outline" className="ml-2">
                        Bajo
                      </Badge>
                    )}
                    {product.stock === 0 && (
                      <Badge variant="destructive" className="ml-2">
                        Sin stock
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-muted-foreground">
                      Stock: {product.stock}
                    </div>
                    <div className="text-lg font-bold text-primary">
                      ${product.price.toFixed(2)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
