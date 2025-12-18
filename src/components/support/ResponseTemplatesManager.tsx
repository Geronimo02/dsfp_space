import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Copy, FileText, Search } from "lucide-react";

interface Template {
  id: string;
  name: string;
  subject: string | null;
  content: string;
  category: string | null;
  is_active: boolean;
  usage_count: number;
}

interface ResponseTemplatesManagerProps {
  onSelectTemplate?: (template: Template) => void;
  mode?: 'manage' | 'select';
}

export function ResponseTemplatesManager({ onSelectTemplate, mode = 'manage' }: ResponseTemplatesManagerProps) {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    content: "",
    category: "general"
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["support-templates", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("customer_support_templates")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("usage_count", { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
    enabled: !!currentCompany?.id
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      if (editingTemplate) {
        const { error } = await supabase
          .from("customer_support_templates")
          .update({
            name: form.name,
            subject: form.subject || null,
            content: form.content,
            category: form.category
          })
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customer_support_templates")
          .insert({
            company_id: currentCompany?.id,
            name: form.name,
            subject: form.subject || null,
            content: form.content,
            category: form.category,
            created_by: user.id
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingTemplate ? "Plantilla actualizada" : "Plantilla creada");
      queryClient.invalidateQueries({ queryKey: ["support-templates"] });
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al guardar plantilla");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_support_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plantilla eliminada");
      queryClient.invalidateQueries({ queryKey: ["support-templates"] });
    }
  });

  const incrementUsage = async (template: Template) => {
    await supabase
      .from("customer_support_templates")
      .update({ usage_count: template.usage_count + 1 })
      .eq("id", template.id);
    queryClient.invalidateQueries({ queryKey: ["support-templates"] });
  };

  const resetForm = () => {
    setForm({ name: "", subject: "", content: "", category: "general" });
    setEditingTemplate(null);
    setIsOpen(false);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      subject: template.subject || "",
      content: template.content,
      category: template.category || "general"
    });
    setIsOpen(true);
  };

  const handleSelectTemplate = (template: Template) => {
    if (onSelectTemplate) {
      incrementUsage(template);
      onSelectTemplate(template);
    }
  };

  const filteredTemplates = templates?.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryLabel = (category: string | null) => {
    const labels: Record<string, string> = {
      general: "General",
      greeting: "Saludo",
      closing: "Cierre",
      technical: "Técnico",
      billing: "Facturación",
      apology: "Disculpa"
    };
    return labels[category || "general"] || category;
  };

  if (mode === 'select') {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar plantilla..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-2">
          {filteredTemplates?.map((template) => (
            <Card
              key={template.id}
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleSelectTemplate(template)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm">{template.name}</div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {template.content}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs ml-2">
                  {getCategoryLabel(template.category)}
                </Badge>
              </div>
            </Card>
          ))}
          {filteredTemplates?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No se encontraron plantillas
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Plantillas de Respuesta
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Plantilla
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Editar Plantilla" : "Nueva Plantilla"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Saludo inicial"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) => setForm({ ...form, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="greeting">Saludo</SelectItem>
                    <SelectItem value="closing">Cierre</SelectItem>
                    <SelectItem value="technical">Técnico</SelectItem>
                    <SelectItem value="billing">Facturación</SelectItem>
                    <SelectItem value="apology">Disculpa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asunto (opcional)</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Asunto del mensaje"
                />
              </div>
              <div className="space-y-2">
                <Label>Contenido</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Escriba el contenido de la plantilla..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{nombre_cliente}'} para insertar el nombre del cliente
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => saveMutation.mutate()}
                  disabled={!form.name || !form.content}
                >
                  {editingTemplate ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar plantillas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredTemplates?.map((template) => (
            <Card key={template.id} className="p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{template.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {getCategoryLabel(template.category)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {template.usage_count} usos
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {template.content}
                  </p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(template.content);
                      toast.success("Copiado al portapapeles");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {filteredTemplates?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay plantillas creadas
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
