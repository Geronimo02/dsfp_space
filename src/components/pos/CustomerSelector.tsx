import { useState } from "react";
import { Search, Plus, User, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyalty_points?: number;
  price_list_id?: string;
}

interface CustomerSelectorProps {
  customers: Customer[];
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  onCreateCustomer: (customer: { name: string; phone: string; email: string; document: string }) => Promise<void>;
  walkInSale: boolean;
  onWalkInToggle: (value: boolean) => void;
}

export function CustomerSelector({
  customers,
  selectedCustomer,
  onSelectCustomer,
  onCreateCustomer,
  walkInSale,
  onWalkInToggle,
}: CustomerSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    document: "",
  });

  const filteredCustomers = customers?.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleCreate = async () => {
    await onCreateCustomer(newCustomer);
    setShowCreateDialog(false);
    setNewCustomer({ name: "", phone: "", email: "", document: "" });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="walkIn"
                checked={walkInSale}
                onChange={(e) => onWalkInToggle(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="walkIn">Venta sin cliente (público general)</Label>
            </div>

            {!walkInSale && (
              <>
                {selectedCustomer ? (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{selectedCustomer.name}</p>
                        {selectedCustomer.phone && (
                          <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectCustomer(null)}
                      >
                        Cambiar
                      </Button>
                    </div>
                    {selectedCustomer.loyalty_points !== undefined && selectedCustomer.loyalty_points > 0 && (
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <Star className="h-3 w-3" />
                        {selectedCustomer.loyalty_points} puntos
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {searchTerm && (
                      <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                        {filteredCustomers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No se encontraron clientes
                          </p>
                        ) : (
                          filteredCustomers.map((customer) => (
                            <Button
                              key={customer.id}
                              variant="ghost"
                              className="w-full justify-start"
                              onClick={() => {
                                onSelectCustomer(customer);
                                setSearchTerm("");
                              }}
                            >
                              <div className="text-left">
                                <p className="font-medium">{customer.name}</p>
                                {customer.phone && (
                                  <p className="text-xs text-muted-foreground">{customer.phone}</p>
                                )}
                              </div>
                            </Button>
                          ))
                        )}
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowCreateDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Crear nuevo cliente
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nuevo cliente</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo cliente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="+54 11 1234-5678"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="cliente@ejemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="document">Documento</Label>
              <Input
                id="document"
                value={newCustomer.document}
                onChange={(e) => setNewCustomer({ ...newCustomer, document: e.target.value })}
                placeholder="DNI/CUIT"
              />
            </div>
            <Button onClick={handleCreate} disabled={!newCustomer.name} className="w-full">
              Crear cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
