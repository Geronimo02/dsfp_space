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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-900 to-purple-900 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 flex items-center justify-center">
            <img src="/landing/images/ChatGPT Image 5 dic 2025, 12_17_26.png" alt="Ventify Space" className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ventify Space</h1>
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
