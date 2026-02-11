import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";
import {
  Package, ShoppingCart, UserPlus, Wallet, BarChart3,
  UtensilsCrossed, Receipt, FileText, DollarSign, Truck,
  AlertTriangle, CheckCircle2, X, Rocket,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Package, ShoppingCart, UserPlus, Wallet, BarChart3,
  UtensilsCrossed, Receipt, FileText, DollarSign, Truck,
  AlertTriangle,
};

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const {
    checklist,
    completedItems,
    completedCount,
    totalItems,
    shouldShow,
    completeItem,
    dismissOnboarding,
  } = useOnboardingChecklist();

  if (!shouldShow || !checklist) return null;

  const progressPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-md mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary shrink-0" />
            <div>
              <CardTitle className="text-lg">¡Bienvenido! Primeros pasos</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{checklist.tagline}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={dismissOnboarding}
            title="Cerrar tutorial"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Progress value={progressPercent} className="h-2 flex-1" />
          <Badge variant="secondary" className="text-xs whitespace-nowrap">
            {completedCount}/{totalItems}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1.5">
        {checklist.items.map((item) => {
          const done = completedItems.has(item.key);
          const IconComp = ICON_MAP[item.icon] || Package;
          return (
            <div
              key={item.key}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group ${
                done
                  ? "bg-muted/40 border-muted opacity-70"
                  : "bg-background hover:bg-accent/50 border-border hover:border-primary/40"
              }`}
              onClick={() => {
                if (!done) {
                  completeItem(item.key);
                }
                navigate(item.link);
              }}
            >
              <div className={`p-2 rounded-lg shrink-0 ${done ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"}`}>
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <IconComp className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
              </div>
              {!done && (
                <Badge variant="outline" className="text-xs shrink-0">
                  Ir →
                </Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
