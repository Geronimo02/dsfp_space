import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Plus, Search, FileText, FolderOpen, Eye, ThumbsUp, ThumbsDown, 
  Edit, Trash2, BookOpen, BarChart3, Tag
} from "lucide-react";

interface KnowledgeCategory {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  icon: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

interface KnowledgeArticle {
  id: string;
  company_id: string;
  category_id: string | null;
  title: string;
  content: string;
  slug: string | null;
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  tags: string[];
  created_at: string;
  category?: KnowledgeCategory;
}

export default function KnowledgeBase() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("articles");
  
  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<KnowledgeCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", icon: "FileText" });
  
  // Article dialog state
  const [articleDialogOpen, setArticleDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeArticle | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: "",
    content: "",
    category_id: "",
    is_published: false,
    is_featured: false,
    tags: ""
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["knowledge-categories", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("knowledge_base_categories")
        .select("*")
        .eq("company_id", currentCompany.id)
        .order("order_index");
      if (error) throw error;
      return data as KnowledgeCategory[];
    },
    enabled: !!currentCompany?.id
  });

  // Fetch articles
  const { data: articles = [] } = useQuery({
    queryKey: ["knowledge-articles", currentCompany?.id, selectedCategory, searchQuery],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      let query = supabase
        .from("knowledge_base_articles")
        .select("*, category:knowledge_base_categories(*)")
        .eq("company_id", currentCompany.id)
        .order("created_at", { ascending: false });
      
      if (selectedCategory !== "all") {
        query = query.eq("category_id", selectedCategory);
      }
      
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as KnowledgeArticle[];
    },
    enabled: !!currentCompany?.id
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const { error } = await supabase
        .from("knowledge_base_categories")
        .insert({
          company_id: currentCompany!.id,
          name: data.name,
          description: data.description || null,
          icon: data.icon,
          order_index: categories.length
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      setCategoryDialogOpen(false);
      setCategoryForm({ name: "", description: "", icon: "FileText" });
      toast.success("Categoría creada exitosamente");
    },
    onError: () => toast.error("Error al crear la categoría")
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof categoryForm }) => {
      const { error } = await supabase
        .from("knowledge_base_categories")
        .update({
          name: data.name,
          description: data.description || null,
          icon: data.icon
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", icon: "FileText" });
      toast.success("Categoría actualizada");
    },
    onError: () => toast.error("Error al actualizar la categoría")
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_base_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-categories"] });
      toast.success("Categoría eliminada");
    },
    onError: () => toast.error("Error al eliminar la categoría")
  });

  // Article mutations
  const createArticleMutation = useMutation({
    mutationFn: async (data: typeof articleForm) => {
      const { error } = await supabase
        .from("knowledge_base_articles")
        .insert({
          company_id: currentCompany!.id,
          title: data.title,
          content: data.content,
          category_id: data.category_id || null,
          is_published: data.is_published,
          is_featured: data.is_featured,
          tags: data.tags.split(",").map(t => t.trim()).filter(Boolean),
          slug: data.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      setArticleDialogOpen(false);
      resetArticleForm();
      toast.success("Artículo creado exitosamente");
    },
    onError: () => toast.error("Error al crear el artículo")
  });

  const updateArticleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof articleForm }) => {
      const { error } = await supabase
        .from("knowledge_base_articles")
        .update({
          title: data.title,
          content: data.content,
          category_id: data.category_id || null,
          is_published: data.is_published,
          is_featured: data.is_featured,
          tags: data.tags.split(",").map(t => t.trim()).filter(Boolean)
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      setArticleDialogOpen(false);
      setEditingArticle(null);
      resetArticleForm();
      toast.success("Artículo actualizado");
    },
    onError: () => toast.error("Error al actualizar el artículo")
  });

  const deleteArticleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("knowledge_base_articles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
      toast.success("Artículo eliminado");
    },
    onError: () => toast.error("Error al eliminar el artículo")
  });

  const resetArticleForm = () => {
    setArticleForm({
      title: "",
      content: "",
      category_id: "",
      is_published: false,
      is_featured: false,
      tags: ""
    });
  };

  const handleEditCategory = (category: KnowledgeCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || "",
      icon: category.icon
    });
    setCategoryDialogOpen(true);
  };

  const handleEditArticle = (article: KnowledgeArticle) => {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      content: article.content,
      category_id: article.category_id || "",
      is_published: article.is_published,
      is_featured: article.is_featured,
      tags: article.tags?.join(", ") || ""
    });
    setArticleDialogOpen(true);
  };

  const handleSaveCategory = () => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryForm });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const handleSaveArticle = () => {
    if (editingArticle) {
      updateArticleMutation.mutate({ id: editingArticle.id, data: articleForm });
    } else {
      createArticleMutation.mutate(articleForm);
    }
  };

  // Statistics
  const totalArticles = articles.length;
  const publishedArticles = articles.filter(a => a.is_published).length;
  const totalViews = articles.reduce((acc, a) => acc + a.view_count, 0);
  const totalHelpful = articles.reduce((acc, a) => acc + a.helpful_count, 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Base de Conocimiento
            </h1>
            <p className="text-muted-foreground">
              Gestiona artículos y FAQs para tu equipo de soporte
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
              setCategoryDialogOpen(open);
              if (!open) {
                setEditingCategory(null);
                setCategoryForm({ name: "", description: "", icon: "FileText" });
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Nueva Categoría
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="Ej: Pagos, Envíos, Devoluciones"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Textarea
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      placeholder="Descripción de la categoría..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveCategory} disabled={!categoryForm.name}>
                    {editingCategory ? "Actualizar" : "Crear"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={articleDialogOpen} onOpenChange={(open) => {
              setArticleDialogOpen(open);
              if (!open) {
                setEditingArticle(null);
                resetArticleForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Artículo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingArticle ? "Editar Artículo" : "Nuevo Artículo"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Título / Pregunta</Label>
                    <Input
                      value={articleForm.title}
                      onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                      placeholder="Ej: ¿Cómo puedo hacer una devolución?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Select
                      value={articleForm.category_id}
                      onValueChange={(value) => setArticleForm({ ...articleForm, category_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin categoría</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Contenido (Markdown soportado)</Label>
                    <Textarea
                      value={articleForm.content}
                      onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                      placeholder="Escribe el contenido del artículo..."
                      className="min-h-[200px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Etiquetas (separadas por coma)</Label>
                    <Input
                      value={articleForm.tags}
                      onChange={(e) => setArticleForm({ ...articleForm, tags: e.target.value })}
                      placeholder="devolución, reembolso, garantía"
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={articleForm.is_published}
                        onCheckedChange={(checked) => setArticleForm({ ...articleForm, is_published: checked })}
                      />
                      <Label>Publicado</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={articleForm.is_featured}
                        onCheckedChange={(checked) => setArticleForm({ ...articleForm, is_featured: checked })}
                      />
                      <Label>Destacado</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setArticleDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveArticle} disabled={!articleForm.title || !articleForm.content}>
                    {editingArticle ? "Actualizar" : "Crear"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalArticles}</p>
                  <p className="text-sm text-muted-foreground">Total Artículos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Eye className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{publishedArticles}</p>
                  <p className="text-sm text-muted-foreground">Publicados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{totalViews}</p>
                  <p className="text-sm text-muted-foreground">Vistas Totales</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ThumbsUp className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{totalHelpful}</p>
                  <p className="text-sm text-muted-foreground">Útiles</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="articles">Artículos</TabsTrigger>
            <TabsTrigger value="categories">Categorías</TabsTrigger>
          </TabsList>

          <TabsContent value="articles" className="space-y-4">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar artículos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Articles List */}
            <div className="space-y-3">
              {articles.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay artículos aún</p>
                    <Button className="mt-4" onClick={() => setArticleDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primer artículo
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                articles.map((article) => (
                  <Card key={article.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h3 className="font-semibold truncate">{article.title}</h3>
                            {article.is_published ? (
                              <Badge variant="default" className="bg-green-500">Publicado</Badge>
                            ) : (
                              <Badge variant="secondary">Borrador</Badge>
                            )}
                            {article.is_featured && (
                              <Badge variant="outline" className="border-yellow-500 text-yellow-600">Destacado</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {article.content.substring(0, 150)}...
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {article.category && (
                              <span className="flex items-center gap-1">
                                <FolderOpen className="h-3 w-3" />
                                {article.category.name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {article.view_count} vistas
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              {article.helpful_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsDown className="h-3 w-3" />
                              {article.not_helpful_count}
                            </span>
                          </div>
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              <Tag className="h-3 w-3 text-muted-foreground" />
                              {article.tags.map((tag, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditArticle(article)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("¿Eliminar este artículo?")) {
                                deleteArticleMutation.mutate(article.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No hay categorías aún</p>
                    <Button className="mt-4" onClick={() => setCategoryDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primera categoría
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                categories.map((category) => {
                  const articleCount = articles.filter(a => a.category_id === category.id).length;
                  return (
                    <Card key={category.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <FolderOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{category.name}</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {articleCount} artículos
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditCategory(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("¿Eliminar esta categoría?")) {
                                  deleteCategoryMutation.mutate(category.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {category.description && (
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground">
                            {category.description}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
