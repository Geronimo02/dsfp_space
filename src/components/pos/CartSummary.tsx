import { ShoppingCart, Plus, Minus, Trash2, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface CartSummaryProps {
  cart: CartItem[];
  discountRate: number;
  onDiscountChange: (rate: number) => void;
  onUpdateQuantity: (productId: string, change: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  loyaltyDiscount?: number;
}

export function CartSummary({
  cart,
  discountRate,
  onDiscountChange,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  loyaltyDiscount = 0,
}: CartSummaryProps) {
  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const discountAmount = (subtotal * discountRate) / 100;
  const loyaltyDiscountAmount = loyaltyDiscount;
  const total = subtotal - discountAmount - loyaltyDiscountAmount;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Carrito ({cart.length})
          </CardTitle>
          {cart.length > 0 && (
            <Button variant="outline" size="sm" onClick={onClearCart}>
              Limpiar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {cart.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            El carrito está vacío
          </div>
        ) : (
          <>
            <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center gap-4 p-2 bg-muted rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${item.unit_price.toFixed(2)} c/u
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => onUpdateQuantity(item.product_id, -1)}
                      disabled={item.quantity <= 1}
                      aria-label={`Reducir cantidad de ${item.product_name}`}
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <span className="w-8 text-center font-medium" aria-label={`Cantidad: ${item.quantity}`}>{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => onUpdateQuantity(item.product_id, 1)}
                      aria-label={`Aumentar cantidad de ${item.product_name}`}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="font-bold">${item.subtotal.toFixed(2)}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onRemoveItem(item.product_id)}
                    aria-label={`Eliminar ${item.product_name} del carrito`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="discount" className="flex items-center gap-1">
                  <Percent className="h-4 w-4" aria-hidden="true" />
                  Descuento %
                </Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  value={discountRate}
                  onChange={(e) => onDiscountChange(Number(e.target.value))}
                  className="w-20"
                  aria-label="Porcentaje de descuento"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={discountRate}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>

              {discountRate > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Descuento ({discountRate}%):</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}

              {loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Puntos de lealtad:</span>
                  <span>-${loyaltyDiscountAmount.toFixed(2)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
