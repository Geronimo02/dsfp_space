-- Create knowledge base categories table
CREATE TABLE public.knowledge_base_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'FileText',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create knowledge base articles table
CREATE TABLE public.knowledge_base_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.knowledge_base_categories(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  slug VARCHAR(255),
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_kb_categories_company ON public.knowledge_base_categories(company_id);
CREATE INDEX idx_kb_articles_company ON public.knowledge_base_articles(company_id);
CREATE INDEX idx_kb_articles_category ON public.knowledge_base_articles(category_id);
CREATE INDEX idx_kb_articles_published ON public.knowledge_base_articles(is_published);
CREATE INDEX idx_kb_articles_tags ON public.knowledge_base_articles USING GIN(tags);

-- Enable RLS
ALTER TABLE public.knowledge_base_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- RLS policies for categories
CREATE POLICY "Users can view categories from their company"
ON public.knowledge_base_categories FOR SELECT
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can insert categories in their company"
ON public.knowledge_base_categories FOR INSERT
WITH CHECK (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can update categories in their company"
ON public.knowledge_base_categories FOR UPDATE
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can delete categories in their company"
ON public.knowledge_base_categories FOR DELETE
USING (company_id IN (SELECT get_user_companies(auth.uid())));

-- RLS policies for articles
CREATE POLICY "Users can view articles from their company"
ON public.knowledge_base_articles FOR SELECT
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can insert articles in their company"
ON public.knowledge_base_articles FOR INSERT
WITH CHECK (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can update articles in their company"
ON public.knowledge_base_articles FOR UPDATE
USING (company_id IN (SELECT get_user_companies(auth.uid())));

CREATE POLICY "Users can delete articles in their company"
ON public.knowledge_base_articles FOR DELETE
USING (company_id IN (SELECT get_user_companies(auth.uid())));

-- Trigger for updated_at
CREATE TRIGGER update_kb_categories_updated_at
BEFORE UPDATE ON public.knowledge_base_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kb_articles_updated_at
BEFORE UPDATE ON public.knowledge_base_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();