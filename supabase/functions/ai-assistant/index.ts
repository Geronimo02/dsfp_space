import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, type, companyId, context } = await req.json();

    // Verify user belongs to the company
    if (companyId) {
      const { data: membership } = await supabaseClient
        .from('company_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .eq('active', true)
        .maybeSingle();

      if (!membership) {
        console.error('User does not belong to company:', companyId);
        return new Response(JSON.stringify({ error: 'Acceso denegado a esta empresa' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no configurada');
    }

    let systemPrompt = '';
    let dataContext = '';

    // Fetch data based on query type
    if (type === 'chat' || type === 'search') {
      systemPrompt = `Eres un asistente de negocios experto para sistemas de punto de venta y gestión comercial.
Tu rol es ayudar a analizar datos de ventas, inventario, clientes y finanzas.
Responde de forma clara, concisa y profesional en español.
Proporciona insights accionables cuando sea posible.
Si no tienes datos suficientes para responder algo específico, indícalo claramente.`;

      // Get recent sales
      const { data: sales } = await supabaseClient
        .from('sales')
        .select('id, total, payment_method, status, created_at, customer_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);

      // Get products with stock info
      const { data: products } = await supabaseClient
        .from('products')
        .select('id, name, price, stock, min_stock, category')
        .eq('company_id', companyId);

      // Get customers
      const { data: customers } = await supabaseClient
        .from('customers')
        .select('id, name, total_purchases, current_balance')
        .eq('company_id', companyId)
        .limit(50);

      // Calculate metrics
      const totalSales = sales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
      const salesCount = sales?.length || 0;
      const lowStockProducts = products?.filter(p => p.stock <= (p.min_stock || 5)) || [];
      const topProducts = products?.sort((a, b) => (b.stock || 0) - (a.stock || 0)).slice(0, 10) || [];

      dataContext = `
RESUMEN DE DATOS DE LA EMPRESA:

📊 VENTAS (últimas 100 transacciones):
- Total de ventas: $${totalSales.toLocaleString()}
- Cantidad de ventas: ${salesCount}
- Promedio por venta: $${salesCount > 0 ? (totalSales / salesCount).toFixed(2) : 0}
- Métodos de pago más usados: ${JSON.stringify(sales?.reduce((acc: any, s) => { acc[s.payment_method || 'otro'] = (acc[s.payment_method || 'otro'] || 0) + 1; return acc; }, {}))}

📦 INVENTARIO:
- Total de productos: ${products?.length || 0}
- Productos con stock bajo (${lowStockProducts.length}): ${lowStockProducts.map(p => `${p.name} (${p.stock} unidades)`).join(', ') || 'Ninguno'}
- Top 10 productos por stock: ${topProducts.map(p => `${p.name}: ${p.stock}`).join(', ')}

👥 CLIENTES:
- Total de clientes: ${customers?.length || 0}
- Clientes con saldo pendiente: ${customers?.filter(c => (c.current_balance || 0) > 0).length || 0}
- Total en cuentas corrientes: $${customers?.reduce((sum, c) => sum + (c.current_balance || 0), 0).toLocaleString()}

${context ? `CONTEXTO ADICIONAL: ${context}` : ''}`;

    } else if (type === 'stock-analysis') {
      systemPrompt = `Eres un experto en gestión de inventario y cadena de suministro.
Analiza los datos de stock y ventas para:
1. Identificar productos que necesitan reposición urgente
2. Detectar productos con rotación lenta
3. Sugerir niveles óptimos de stock
4. Predecir posibles quiebres de stock
Proporciona recomendaciones específicas y prácticas en español.`;

      const { data: products } = await supabaseClient
        .from('products')
        .select('*')
        .eq('company_id', companyId);

      const { data: saleItems } = await supabaseClient
        .from('sale_items')
        .select('product_id, quantity, created_at')
        .eq('company_id', companyId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Calculate product velocity
      const productVelocity: Record<string, number> = {};
      saleItems?.forEach(item => {
        productVelocity[item.product_id] = (productVelocity[item.product_id] || 0) + item.quantity;
      });

      const enrichedProducts = products?.map(p => ({
        ...p,
        velocity_30d: productVelocity[p.id] || 0,
        days_of_stock: productVelocity[p.id] ? Math.round((p.stock || 0) / (productVelocity[p.id] / 30)) : 999,
        needs_reorder: (p.stock || 0) <= (p.min_stock || 5),
      }));

      dataContext = `
ANÁLISIS DE INVENTARIO:

Productos ordenados por urgencia de reposición:
${enrichedProducts?.sort((a, b) => a.days_of_stock - b.days_of_stock).slice(0, 20).map(p => 
  `- ${p.name}: Stock ${p.stock}, Ventas/mes: ${p.velocity_30d}, Días de stock: ${p.days_of_stock}, Min: ${p.min_stock || 'N/A'}`
).join('\n')}

Productos sin movimiento (30 días):
${enrichedProducts?.filter(p => p.velocity_30d === 0 && (p.stock || 0) > 0).slice(0, 10).map(p => 
  `- ${p.name}: Stock ${p.stock}`
).join('\n') || 'Ninguno'}

${context ? `CONTEXTO: ${context}` : ''}`;

    } else if (type === 'sales-prediction') {
      systemPrompt = `Eres un analista de datos especializado en predicción de ventas.
Analiza las tendencias históricas para:
1. Proyectar ventas para los próximos días/semanas
2. Identificar patrones estacionales
3. Detectar anomalías en las ventas
4. Sugerir acciones para mejorar las ventas
Proporciona predicciones realistas basadas en los datos disponibles.`;

      // Get sales by day for the last 60 days
      const { data: sales } = await supabaseClient
        .from('sales')
        .select('total, created_at')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      // Group by day
      const salesByDay: Record<string, number> = {};
      sales?.forEach(s => {
        const day = new Date(s.created_at).toISOString().split('T')[0];
        salesByDay[day] = (salesByDay[day] || 0) + (s.total || 0);
      });

      // Group by day of week
      const salesByDayOfWeek: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      Object.entries(salesByDay).forEach(([date, total]) => {
        const dow = new Date(date).getDay();
        salesByDayOfWeek[dow].push(total);
      });

      const avgByDayOfWeek = Object.entries(salesByDayOfWeek).map(([dow, totals]) => ({
        day: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][parseInt(dow)],
        avg: totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0,
      }));

      dataContext = `
ANÁLISIS DE VENTAS (últimos 60 días):

Ventas diarias recientes:
${Object.entries(salesByDay).slice(-14).map(([date, total]) => `${date}: $${total.toLocaleString()}`).join('\n')}

Promedio por día de la semana:
${avgByDayOfWeek.map(d => `${d.day}: $${d.avg.toFixed(2)}`).join('\n')}

Total del período: $${Object.values(salesByDay).reduce((a, b) => a + b, 0).toLocaleString()}
Promedio diario: $${(Object.values(salesByDay).reduce((a, b) => a + b, 0) / Object.keys(salesByDay).length).toFixed(2)}

${context ? `CONTEXTO: ${context}` : ''}`;

    } else if (type === 'customer-insights') {
      systemPrompt = `Eres un especialista en análisis de clientes y comportamiento de compra.
Analiza los datos para:
1. Identificar los mejores clientes (por valor y frecuencia)
2. Detectar clientes en riesgo de abandono
3. Sugerir estrategias de retención
4. Recomendar acciones para aumentar el ticket promedio
Proporciona insights accionables en español.`;

      const { data: customers } = await supabaseClient
        .from('customers')
        .select('id, name, total_purchases, current_balance, created_at')
        .eq('company_id', companyId);

      const { data: sales } = await supabaseClient
        .from('sales')
        .select('customer_id, total, created_at')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .not('customer_id', 'is', null);

      // Calculate customer metrics
      const customerMetrics: Record<string, { purchases: number; total: number; lastPurchase: string }> = {};
      sales?.forEach(s => {
        if (!s.customer_id) return;
        if (!customerMetrics[s.customer_id]) {
          customerMetrics[s.customer_id] = { purchases: 0, total: 0, lastPurchase: '' };
        }
        customerMetrics[s.customer_id].purchases++;
        customerMetrics[s.customer_id].total += s.total || 0;
        if (s.created_at > customerMetrics[s.customer_id].lastPurchase) {
          customerMetrics[s.customer_id].lastPurchase = s.created_at;
        }
      });

      const enrichedCustomers = customers?.map(c => ({
        ...c,
        ...customerMetrics[c.id],
        daysSinceLastPurchase: customerMetrics[c.id]?.lastPurchase 
          ? Math.floor((Date.now() - new Date(customerMetrics[c.id].lastPurchase).getTime()) / (1000 * 60 * 60 * 24))
          : 999,
      })).sort((a, b) => (b.total || 0) - (a.total || 0));

      dataContext = `
ANÁLISIS DE CLIENTES:

Top 10 clientes por valor:
${enrichedCustomers?.slice(0, 10).map(c => 
  `- ${c.name}: $${(c.total || 0).toLocaleString()}, ${c.purchases || 0} compras, Último: hace ${c.daysSinceLastPurchase} días`
).join('\n')}

Clientes inactivos (>30 días sin comprar):
${enrichedCustomers?.filter(c => c.daysSinceLastPurchase > 30 && (c.total || 0) > 0).slice(0, 10).map(c => 
  `- ${c.name}: ${c.daysSinceLastPurchase} días, $${(c.total || 0).toLocaleString()} histórico`
).join('\n') || 'Ninguno'}

Clientes con saldo pendiente:
${enrichedCustomers?.filter(c => (c.current_balance || 0) > 0).slice(0, 10).map(c => 
  `- ${c.name}: $${(c.current_balance || 0).toLocaleString()} pendiente`
).join('\n') || 'Ninguno'}

${context ? `CONTEXTO: ${context}` : ''}`;

    } else if (type === 'financial-summary') {
      systemPrompt = `Eres un analista financiero especializado en pequeños y medianos negocios.
Proporciona un resumen ejecutivo de la situación financiera incluyendo:
1. Ingresos y tendencias
2. Gastos principales
3. Cuentas por cobrar
4. Recomendaciones de gestión financiera
Sé claro y directo en tus análisis.`;

      const { data: sales } = await supabaseClient
        .from('sales')
        .select('total, payment_method, status, created_at')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const { data: expenses } = await supabaseClient
        .from('expenses')
        .select('amount, category_id, expense_date')
        .eq('company_id', companyId)
        .gte('expense_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const { data: customers } = await supabaseClient
        .from('customers')
        .select('current_balance')
        .eq('company_id', companyId)
        .gt('current_balance', 0);

      const totalSales = sales?.reduce((sum, s) => sum + (s.total || 0), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const totalReceivables = customers?.reduce((sum, c) => sum + (c.current_balance || 0), 0) || 0;

      // Expenses by category
      const expensesByCategory: Record<string, number> = {};
      expenses?.forEach(e => {
        expensesByCategory[e.category_id || 'otros'] = (expensesByCategory[e.category_id || 'otros'] || 0) + (e.amount || 0);
      });

      dataContext = `
RESUMEN FINANCIERO (últimos 30 días):

💰 INGRESOS:
- Ventas totales: $${totalSales.toLocaleString()}
- Cantidad de ventas: ${sales?.length || 0}
- Ticket promedio: $${sales?.length ? (totalSales / sales.length).toFixed(2) : 0}

💸 GASTOS:
- Total gastos: $${totalExpenses.toLocaleString()}
- Por categoría:
${Object.entries(expensesByCategory).map(([cat, amount]) => `  - ${cat}: $${amount.toLocaleString()}`).join('\n')}

📋 CUENTAS POR COBRAR:
- Total pendiente: $${totalReceivables.toLocaleString()}
- Clientes con saldo: ${customers?.length || 0}

📈 MARGEN BRUTO:
- Ingresos - Gastos: $${(totalSales - totalExpenses).toLocaleString()}

${context ? `CONTEXTO: ${context}` : ''}`;

    } else {
      // Default report/suggestion type
      systemPrompt = `Eres un consultor de negocios experto en retail y punto de venta.
Proporciona análisis detallados y recomendaciones prácticas basadas en los datos disponibles.
Responde en español de forma profesional pero accesible.`;

      dataContext = context || 'El usuario solicita un análisis general del negocio.';
    }

    console.log('Sending request to OpenAI:', { type, queryLength: query?.length });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${dataContext}\n\n---\n\nConsulta del usuario: ${query}` }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Límite de solicitudes alcanzado. Intenta de nuevo en unos minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorData = await response.text();
      console.error('OpenAI error:', response.status, errorData);
      throw new Error(`Error de OpenAI: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    console.log('Response generated successfully with OpenAI');

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
