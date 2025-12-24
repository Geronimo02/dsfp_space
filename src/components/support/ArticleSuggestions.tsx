import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ChevronRight, Lightbulb } from "lucide-react";

interface ArticleSuggestionsProps {
  searchText: string;
  onArticleSelect?: (article: any) => void;
  maxResults?: number;
}

export function ArticleSuggestions({ 
  searchText, 
  onArticleSelect,
  maxResults = 3 
}: ArticleSuggestionsProps) {
  const { currentCompany } = useCompany();

  const { data: suggestions = [] } = useQuery({
    queryKey: ["article-suggestions", currentCompany?.id, searchText],
    queryFn: async () => {
      if (!currentCompany?.id || !searchText || searchText.length < 3) return [];
      
      const { data, error } = await supabase
        .from("knowledge_base_articles")
        .select("id, title, content, tags, category:knowledge_base_categories(name)")
        .eq("company_id", currentCompany.id)
        .eq("is_published", true)
        .or(`title.ilike.%${searchText}%,content.ilike.%${searchText}%,tags.cs.{${searchText}}`)
        .limit(maxResults);
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && !!searchText && searchText.length >= 3
  });

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lightbulb className="h-4 w-4 text-yellow-500" />
        <span>Artículos que podrían ayudar:</span>
      </div>
      <div className="space-y-2">
        {suggestions.map((article: any) => (
          <Card 
            key={article.id} 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onArticleSelect?.(article)}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{article.title}</p>
                    {article.category && (
                      <Badge variant="outline" className="text-xs mt-1">
                        {article.category.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
