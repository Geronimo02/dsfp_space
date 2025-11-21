import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, type, companyId, context } = await req.json();
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY no configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let systemPrompt = '';
    let dataContext = '';

    // Obtener datos según el tipo de consulta
    if (type === 'search') {
      // Búsqueda en lenguaje natural
      systemPrompt = `Eres un asistente experto en análisis de datos de ventas y productos. 
Tu trabajo es interpretar consultas en lenguaje natural y proporcionar respuestas precisas basadas en los datos disponibles.
Responde de forma concisa y profesional en español.`;

      // Obtener ventas recientes
      const { data: sales } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);

      // Obtener productos
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId);

      dataContext = `Datos disponibles:
Ventas recientes: ${JSON.stringify(sales?.slice(0, 10) || [])}
Productos: ${JSON.stringify(products || [])}`;

    } else if (type === 'suggestion') {
      // Sugerencias inteligentes
      systemPrompt = `Eres un consultor de negocios experto. Analiza los datos de ventas, stock y compras para proporcionar sugerencias accionables.
Enfócate en identificar oportunidades de mejora, productos con bajo stock, tendencias de ventas, etc.
Proporciona recomendaciones específicas y prácticas en español.`;

      // Obtener datos para análisis
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId);

      const { data: sales } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('company_id', companyId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      dataContext = `Datos para análisis:
Productos: ${JSON.stringify(products || [])}
Ventas últimos 30 días: ${JSON.stringify(sales || [])}
${context ? `Contexto adicional: ${context}` : ''}`;

    } else if (type === 'report') {
      // Explicación de reportes
      systemPrompt = `Eres un analista de datos experto. Tu trabajo es explicar tendencias, comparaciones y patrones en los datos de ventas.
Proporciona explicaciones claras y detalladas de por qué ocurren ciertos cambios en las métricas.
Identifica los factores clave que influyen en los resultados.
Responde en español de forma profesional pero accesible.`;

      dataContext = `Datos del reporte:
${context || 'No se proporcionó contexto del reporte'}`;
    }

    console.log('Enviando consulta a OpenAI:', { type, query });

    // Llamar a OpenAI con GPT-5 mini
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${dataContext}\n\nConsulta del usuario: ${query}` }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error de OpenAI:', response.status, errorData);
      throw new Error(`Error de OpenAI: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('Respuesta generada exitosamente');

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error en ai-assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
