import { useState } from "react";
import { DollarSign, CreditCard, Plus, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export interface PaymentMethod {
  id: string;
  method: string;
  baseAmount: number;
  surcharge: number;
  amount: number;
  installments?: number;
  currency?: string;
}

interface PaymentSectionProps {
  totalAmount: number;
  paymentMethods: PaymentMethod[];
  onAddPayment: (payment: Omit<PaymentMethod, 'id'>) => void;
  onRemovePayment: (id: string) => void;
  onCompleteSale: () => void;
  isProcessing: boolean;
  disabled?: boolean;
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Efectivo', icon: DollarSign },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: DollarSign },
  { value: 'debit', label: 'Débito', icon: CreditCard },
];

const CURRENCIES = [
  { value: 'ARS', label: 'ARS ($)' },
  { value: 'USD', label: 'USD (U$S)' },
  { value: 'EUR', label: 'EUR (€)' },
];

export function PaymentSection({
  totalAmount,
  paymentMethods,
  onAddPayment,
  onRemovePayment,
  onCompleteSale,
  isProcessing,
  disabled = false,
}: PaymentSectionProps) {
  const [currentMethod, setCurrentMethod] = useState('cash');
  const [currentAmount, setCurrentAmount] = useState('');
  const [currentInstallments, setCurrentInstallments] = useState(1);
  const [currentCurrency, setCurrentCurrency] = useState('ARS');

  const totalPaid = paymentMethods.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalAmount - totalPaid;
  const isPaymentComplete = remaining <= 0;

  const handleAddPayment = () => {
    const amount = parseFloat(currentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const surcharge = currentMethod === 'card' && currentInstallments > 1 
      ? amount * 0.05 * (currentInstallments - 1)
      : 0;

    onAddPayment({
      method: currentMethod,
      baseAmount: amount,
      surcharge,
      amount: amount + surcharge,
      installments: currentMethod === 'card' ? currentInstallments : 1,
      currency: currentCurrency,
    });

    setCurrentAmount('');
    setCurrentInstallments(1);
  };

  const fillRemaining = () => {
    setCurrentAmount(remaining.toFixed(2));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Pagos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Payment Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2" role="status" aria-live="polite">
            <div className="flex justify-between text-sm">
              <span>Total a pagar:</span>
              <span className="font-bold" aria-label={`Total: ${totalAmount.toFixed(2)} pesos`}>${totalAmount.toFixed(2)}</span>
            </div>
            {paymentMethods.length > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span>Total pagado:</span>
                  <span className="font-semibold text-green-600">${totalPaid.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className={remaining > 0 ? "text-red-600" : "text-green-600"}>
                    {remaining > 0 ? "Falta:" : "Cambio:"}
                  </span>
                  <span className="font-bold">
                    ${Math.abs(remaining).toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Payment Methods List */}
          {paymentMethods.length > 0 && (
            <div className="space-y-2">
              {paymentMethods.map((payment) => (
                <div key={payment.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                  <Badge variant="outline">{payment.method.toUpperCase()}</Badge>
                  <span className="flex-1 text-sm">
                    ${payment.baseAmount.toFixed(2)}
                    {payment.surcharge > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {" "}+ ${payment.surcharge.toFixed(2)} recargo
                      </span>
                    )}
                    {payment.installments && payment.installments > 1 && (
                      <span className="text-xs text-muted-foreground">
                        {" "}({payment.installments}x)
                      </span>
                    )}
                  </span>
                  <span className="font-semibold">${payment.amount.toFixed(2)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar pago"
                    onClick={() => onRemovePayment(payment.id)}
                    disabled={isProcessing}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add Payment Form */}
          {!isPaymentComplete && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="paymentMethod">Método</Label>
                    <Select value={currentMethod} onValueChange={setCurrentMethod}>
                      <SelectTrigger id="paymentMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHOD_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="currency">Moneda</Label>
                    <Select value={currentCurrency} onValueChange={setCurrentCurrency}>
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.value} value={curr.value}>
                            {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {currentMethod === 'card' && (
                  <div>
                    <Label htmlFor="installments">Cuotas</Label>
                    <Select
                      value={currentInstallments.toString()}
                      onValueChange={(v) => setCurrentInstallments(parseInt(v))}
                    >
                      <SelectTrigger id="installments">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 3, 6, 12].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === 1 ? 'cuota' : 'cuotas'}
                            {num > 1 && ' (+5% c/u)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="amount">Monto</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={currentAmount}
                      onChange={(e) => setCurrentAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button variant="outline" onClick={fillRemaining}>
                      Restante
                    </Button>
                    <Button onClick={handleAddPayment} disabled={!currentAmount}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Complete Sale Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={onCompleteSale}
            disabled={disabled || !isPaymentComplete || isProcessing}
            aria-label={isProcessing ? "Procesando venta" : "Completar venta"}
            aria-busy={isProcessing}
          >
            {isProcessing ? (
              "Procesando..."
            ) : (
              <>
                <Check className="mr-2 h-5 w-5" aria-hidden="true" />
                Completar Venta
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
