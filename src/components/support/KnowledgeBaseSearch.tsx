import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, FolderOpen, ThumbsUp, ThumbsDown, Eye, X } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeBaseSearchProps {
  onClose?: () => void;
}

export function KnowledgeBaseSearch({ onClose }: KnowledgeBaseSearchProps) {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["kb-search", currentCompany?.id, searchQuery],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      let query = supabase
        .from("knowledge_base_articles")
        .select("*, category:knowledge_base_categories(name)")
        .eq("company_id", currentCompany.id)
        .eq("is_published", true)
        .order("is_featured", { ascending: false })
        .order("view_count", { ascending: false });
      
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["kb-categories", currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from("knowledge_base_categories")
        .select("*, articles:knowledge_base_articles(count)")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id
  });

  const incrementViewMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const { data: article } = await supabase
        .from("knowledge_base_articles")
        .select("view_count")
        .eq("id", articleId)
        .single();
      
      await supabase
        .from("knowledge_base_articles")
        .update({ view_count: (article?.view_count || 0) + 1 })
        .eq("id", articleId);
    }
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ articleId, helpful }: { articleId: string; helpful: boolean }) => {
      const column = helpful ? "helpful_count" : "not_helpful_count";
      const { data: article } = await supabase
        .from("knowledge_base_articles")
        .select(column)
        .eq("id", articleId)
        .single();
      
      const currentCount = article?.[column] || 0;
      
      const { error } = await supabase
        .from("knowledge_base_articles")
        .update({ [column]: currentCount + 1 })
        .eq("id", articleId);
      
      if (error) throw error;
    },
    onSuccess: (_, { helpful }) => {
      toast.success(helpful ? "¡Gracias por tu feedback!" : "Gracias, mejoraremos este artículo");
      queryClient.invalidateQueries({ queryKey: ["kb-search"] });
    }
  });

  const handleArticleClick = (article: any) => {
    setSelectedArticle(article);
    incrementViewMutation.mutate(article.id);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar en la base de conocimiento..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories */}
      {!searchQuery && categories.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {categories.map((category: any) => (
            <Card 
              key={category.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => setSearchQuery(category.name)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Articles List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Buscando...
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No se encontraron artículos</p>
            </div>
          ) : (
            articles.map((article: any) => (
              <Card 
                key={article.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleArticleClick(article)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{article.title}</span>
                        {article.is_featured && (
                          <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                            Destacado
                          </Badge>
                        )}
                      </div>
                      {article.category && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          {article.category.name}
                        </Badge>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {article.helpful_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Article Detail Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="pr-8">{selectedArticle?.title}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap">{selectedArticle?.content}</div>
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              ¿Te fue útil este artículo?
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  feedbackMutation.mutate({ articleId: selectedArticle?.id, helpful: true });
                  setSelectedArticle(null);
                }}
              >
                <ThumbsUp className="h-4 w-4 mr-1" />
                Sí
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  feedbackMutation.mutate({ articleId: selectedArticle?.id, helpful: false });
                  setSelectedArticle(null);
                }}
              >
                <ThumbsDown className="h-4 w-4 mr-1" />
                No
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
