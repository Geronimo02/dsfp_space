import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Plus,
  Minus
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CashRegister {
  id: string;
  opening_date: string;
  closing_date: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  status: string;
  notes: string | null;
}

interface CashMovement {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
}

export default function CashRegister() {
  const [currentRegister, setCurrentRegister] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [movementDialog, setMovementDialog] = useState(false);

  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const [movementType, setMovementType] = useState<string>("income");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementCategory, setMovementCategory] = useState("");
  const [movementDescription, setMovementDescription] = useState("");

  useEffect(() => {
    fetchCurrentRegister();
  }, []);

  const fetchCurrentRegister = async () => {
    try {
      setLoading(true);
      
      // Get current open register
      const { data: register, error: registerError } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("status", "open")
        .order("opening_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (registerError) throw registerError;

      setCurrentRegister(register);

      // Get movements if there's an open register
      if (register) {
        const { data: movementsData, error: movementsError } = await supabase
          .from("cash_movements")
          .select("*")
          .eq("cash_register_id", register.id)
          .order("created_at", { ascending: false });

        if (movementsError) throw movementsError;
        setMovements(movementsData || []);
      }
    } catch (error: any) {
      toast.error("Error al cargar caja: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegister = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error } = await supabase
        .from("cash_registers")
        .insert({
          user_id: user.id,
          opening_amount: parseFloat(openingAmount) || 0,
          status: "open",
        });

      if (error) throw error;

      toast.success("Caja abierta exitosamente");
      setOpenDialog(false);
      setOpeningAmount("");
      fetchCurrentRegister();
    } catch (error: any) {
      toast.error("Error al abrir caja: " + error.message);
    }
  };

  const handleCloseRegister = async () => {
    if (!currentRegister) return;

    try {
      const closing = parseFloat(closingAmount) || 0;
      const expected = calculateExpectedAmount();
      const difference = closing - expected;

      const { error } = await supabase
        .from("cash_registers")
        .update({
          closing_date: new Date().toISOString(),
          closing_amount: closing,
          expected_amount: expected,
          difference: difference,
          status: "closed",
          notes: closingNotes || null,
        })
        .eq("id", currentRegister.id);

      if (error) throw error;

      toast.success("Caja cerrada exitosamente");
      setCloseDialog(false);
      setClosingAmount("");
      setClosingNotes("");
      fetchCurrentRegister();
    } catch (error: any) {
      toast.error("Error al cerrar caja: " + error.message);
    }
  };

  const handleAddMovement = async () => {
    if (!currentRegister) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { error } = await supabase
        .from("cash_movements")
        .insert({
          cash_register_id: currentRegister.id,
          user_id: user.id,
          type: movementType,
          amount: parseFloat(movementAmount) || 0,
          category: movementCategory,
          description: movementDescription || null,
        });

      if (error) throw error;

      toast.success("Movimiento registrado exitosamente");
      setMovementDialog(false);
      setMovementAmount("");
      setMovementCategory("");
      setMovementDescription("");
      fetchCurrentRegister();
    } catch (error: any) {
      toast.error("Error al registrar movimiento: " + error.message);
    }
  };

  const calculateExpectedAmount = () => {
    if (!currentRegister) return 0;
    
    const income = movements
      .filter(m => m.type === "income" || m.type === "deposit")
      .reduce((sum, m) => sum + parseFloat(m.amount.toString()), 0);
    
    const expense = movements
      .filter(m => m.type === "expense" || m.type === "withdrawal")
      .reduce((sum, m) => sum + parseFloat(m.amount.toString()), 0);
    
    return parseFloat(currentRegister.opening_amount.toString()) + income - expense;
  };

  const totalIncome = movements
    .filter(m => m.type === "income" || m.type === "deposit")
    .reduce((sum, m) => sum + parseFloat(m.amount.toString()), 0);

  const totalExpense = movements
    .filter(m => m.type === "expense" || m.type === "withdrawal")
    .reduce((sum, m) => sum + parseFloat(m.amount.toString()), 0);

  const currentAmount = currentRegister ? calculateExpectedAmount() : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestión de Caja</h1>
            <p className="text-muted-foreground mt-1">
              Control de apertura, cierre y movimientos de caja
            </p>
          </div>
          <div className="flex gap-2">
            {!currentRegister ? (
              <Button onClick={() => setOpenDialog(true)}>
                <Clock className="mr-2 h-4 w-4" />
                Abrir Caja
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMovementDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Registrar Movimiento
                </Button>
                <Button variant="destructive" onClick={() => setCloseDialog(true)}>
                  <Clock className="mr-2 h-4 w-4" />
                  Cerrar Caja
                </Button>
              </>
            )}
          </div>
        </div>

        {currentRegister ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Monto Inicial</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${parseFloat(currentRegister.opening_amount.toString()).toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    +${totalIncome.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Egresos</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    -${totalExpense.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    ${currentAmount.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Movimientos del Día</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">
                          No hay movimientos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>
                            <Badge
                              className={
                                movement.type === "income" || movement.type === "deposit"
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }
                            >
                              {movement.type === "income" && "Ingreso"}
                              {movement.type === "expense" && "Egreso"}
                              {movement.type === "deposit" && "Depósito"}
                              {movement.type === "withdrawal" && "Retiro"}
                            </Badge>
                          </TableCell>
                          <TableCell>{movement.category}</TableCell>
                          <TableCell>{movement.description || "-"}</TableCell>
                          <TableCell
                            className={
                              movement.type === "income" || movement.type === "deposit"
                                ? "text-green-600 font-semibold"
                                : "text-red-600 font-semibold"
                            }
                          >
                            {movement.type === "income" || movement.type === "deposit" ? "+" : "-"}
                            ${parseFloat(movement.amount.toString()).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {new Date(movement.created_at).toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No hay caja abierta</h3>
              <p className="text-muted-foreground mb-4">
                Debes abrir la caja para comenzar a registrar movimientos
              </p>
              <Button onClick={() => setOpenDialog(true)}>Abrir Caja</Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Open Register Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="opening-amount">Monto Inicial</Label>
              <Input
                id="opening-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleOpenRegister}>Abrir Caja</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Register Dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm">Monto esperado:</span>
                <span className="text-sm font-bold">${currentAmount.toFixed(2)}</span>
              </div>
            </div>
            <div>
              <Label htmlFor="closing-amount">Monto Final (conteo físico)</Label>
              <Input
                id="closing-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingAmount}
                onChange={(e) => setClosingAmount(e.target.value)}
              />
            </div>
            {closingAmount && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span className="text-sm">Diferencia:</span>
                  <span
                    className={`text-sm font-bold ${
                      parseFloat(closingAmount) - currentAmount >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    ${(parseFloat(closingAmount) - currentAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="closing-notes">Notas (opcional)</Label>
              <Textarea
                id="closing-notes"
                placeholder="Observaciones sobre el cierre de caja..."
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCloseDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCloseRegister}>Cerrar Caja</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement Dialog */}
      <Dialog open={movementDialog} onOpenChange={setMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="movement-type">Tipo de Movimiento</Label>
              <Select value={movementType} onValueChange={setMovementType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Ingreso</SelectItem>
                  <SelectItem value="expense">Egreso</SelectItem>
                  <SelectItem value="deposit">Depósito</SelectItem>
                  <SelectItem value="withdrawal">Retiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="movement-amount">Monto</Label>
              <Input
                id="movement-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="movement-category">Categoría</Label>
              <Input
                id="movement-category"
                placeholder="Ej: Venta, Gasto operativo, etc."
                value={movementCategory}
                onChange={(e) => setMovementCategory(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="movement-description">Descripción (opcional)</Label>
              <Textarea
                id="movement-description"
                placeholder="Detalles del movimiento..."
                value={movementDescription}
                onChange={(e) => setMovementDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMovementDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddMovement}>Registrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
