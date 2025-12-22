import { Button } from "@/components/ui/button";
import { ShoppingCart, LogOut } from "lucide-react";

interface PlatformAdminHeaderProps {
  onLogout: () => void;
}

export function PlatformAdminHeader({ onLogout }: PlatformAdminHeaderProps) {
  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">RetailSnap</h1>
            <p className="text-xs text-muted-foreground">Panel de Administración</p>
          </div>
        </div>
        <Button variant="outline" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}
