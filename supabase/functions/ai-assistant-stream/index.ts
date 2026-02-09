import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
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

    const { query, type, companyId, context, conversationHistory } = await req.json();

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
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY no configurada');
    }

    // Fetch comprehensive company data
    const [
      salesResult,
      productsResult,
      customersResult,
      expensesResult,
      saleItemsResult,
      purchasesResult,
      suppliersResult
    ] = await Promise.all([
      supabaseClient
        .from('sales')
        .select('id, total, payment_method, status, created_at, customer_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabaseClient
        .from('products')
        .select('id, name, price, cost, stock, min_stock, category, active')
        .eq('company_id', companyId),
      supabaseClient
        .from('customers')
        .select('id, name, total_purchases, current_balance, created_at, loyalty_tier')
        .eq('company_id', companyId)
        .limit(100),
      supabaseClient
        .from('expenses')
        .select('amount, category_id, expense_date, description')
        .eq('company_id', companyId)
        .gte('expense_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabaseClient
        .from('sale_items')
        .select('product_id, quantity, subtotal, created_at')
        .eq('company_id', companyId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
      supabaseClient
        .from('purchases')
        .select('total, purchase_date, supplier_id, status')
        .eq('company_id', companyId)
        .gte('purchase_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabaseClient
        .from('suppliers')
        .select('id, name, balance')
        .eq('company_id', companyId)
        .eq('active', true)
    ]);

    const sales = salesResult.data || [];
    const products = productsResult.data || [];
    const customers = customersResult.data || [];
    const expenses = expensesResult.data || [];
    const saleItems = saleItemsResult.data || [];
    const purchases = purchasesResult.data || [];
    const suppliers = suppliersResult.data || [];

    // Calculate comprehensive metrics
    const today = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentSales = sales.filter(s => new Date(s.created_at) >= thirtyDaysAgo);
    const weekSales = sales.filter(s => new Date(s.created_at) >= sevenDaysAgo);

    const totalSales30d = recentSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalSales7d = weekSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const avgTicket = recentSales.length > 0 ? totalSales30d / recentSales.length : 0;

    // Product velocity and stock analysis
    const productVelocity: Record<string, number> = {};
    saleItems.forEach(item => {
      productVelocity[item.product_id] = (productVelocity[item.product_id] || 0) + item.quantity;
    });

    const enrichedProducts = products.map(p => ({
      ...p,
      velocity_30d: productVelocity[p.id] || 0,
      days_of_stock: productVelocity[p.id] ? Math.round((p.stock || 0) / (productVelocity[p.id] / 30)) : 999,
      needs_reorder: (p.stock || 0) <= (p.min_stock || 5),
      revenue_30d: (productVelocity[p.id] || 0) * (p.price || 0),
    }));

    const lowStockProducts = enrichedProducts.filter(p => p.needs_reorder && p.active);
    const deadStock = enrichedProducts.filter(p => p.velocity_30d === 0 && (p.stock || 0) > 0 && p.active);
    const topProducts = enrichedProducts
      .filter(p => p.active)
      .sort((a, b) => b.revenue_30d - a.revenue_30d)
      .slice(0, 10);

    // Customer analysis
    const customerMetrics: Record<string, { purchases: number; total: number; lastPurchase: string }> = {};
    sales.forEach(s => {
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

    const enrichedCustomers = customers.map(c => ({
      ...c,
      ...customerMetrics[c.id],
      daysSinceLastPurchase: customerMetrics[c.id]?.lastPurchase 
        ? Math.floor((Date.now() - new Date(customerMetrics[c.id].lastPurchase).getTime()) / (1000 * 60 * 60 * 24))
        : 999,
    })).sort((a, b) => (b.total || 0) - (a.total || 0));

    const topCustomers = enrichedCustomers.slice(0, 10);
    const inactiveCustomers = enrichedCustomers.filter(c => c.daysSinceLastPurchase > 30 && (c.total || 0) > 0);
    const customersWithDebt = enrichedCustomers.filter(c => (c.current_balance || 0) > 0);

    // Financial analysis
    const totalExpenses30d = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalPurchases30d = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalReceivables = customers.reduce((sum, c) => sum + (c.current_balance || 0), 0);
    const totalPayables = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);
    const grossProfit = totalSales30d - totalPurchases30d;
    const netProfit = grossProfit - totalExpenses30d;

    // Payment method breakdown
    const paymentMethods: Record<string, number> = {};
    recentSales.forEach(s => {
      paymentMethods[s.payment_method || 'otro'] = (paymentMethods[s.payment_method || 'otro'] || 0) + (s.total || 0);
    });

    // Sales by day of week
    const salesByDayOfWeek: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    recentSales.forEach(s => {
      const dow = new Date(s.created_at).getDay();
      salesByDayOfWeek[dow].push(s.total || 0);
    });
    const avgByDayOfWeek = Object.entries(salesByDayOfWeek).map(([dow, totals]) => ({
      day: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][parseInt(dow)],
      avg: totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0,
    }));

    // Build comprehensive context
    const businessContext = `
=== DATOS DEL NEGOCIO EN TIEMPO REAL ===

📊 RESUMEN DE VENTAS (últimos 30 días):
- Total ventas: $${totalSales30d.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
- Ventas últimos 7 días: $${totalSales7d.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
- Cantidad de transacciones: ${recentSales.length}
- Ticket promedio: $${avgTicket.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
- Métodos de pago: ${Object.entries(paymentMethods).map(([m, v]) => `${m}: $${v.toLocaleString('es-AR')}`).join(', ')}

📅 PROMEDIO POR DÍA DE LA SEMANA:
${avgByDayOfWeek.map(d => `- ${d.day}: $${d.avg.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`).join('\n')}

📦 INVENTARIO:
- Total de productos activos: ${products.filter(p => p.active).length}
- Productos con stock bajo (${lowStockProducts.length}): ${lowStockProducts.slice(0, 5).map(p => `${p.name} (${p.stock}/${p.min_stock})`).join(', ') || 'Ninguno'}
- Productos sin movimiento 30d (${deadStock.length}): ${deadStock.slice(0, 5).map(p => `${p.name} (${p.stock} unids)`).join(', ') || 'Ninguno'}
- Top productos por ingresos: ${topProducts.slice(0, 5).map(p => `${p.name} ($${p.revenue_30d.toLocaleString('es-AR')})`).join(', ')}

👥 CLIENTES:
- Total clientes registrados: ${customers.length}
- Top clientes: ${topCustomers.slice(0, 5).map(c => `${c.name} ($${(c.total || 0).toLocaleString('es-AR')}, ${c.purchases || 0} compras)`).join(', ')}
- Clientes inactivos (>30 días): ${inactiveCustomers.length}
- Clientes con deuda: ${customersWithDebt.length} (Total: $${totalReceivables.toLocaleString('es-AR')})

💰 FINANZAS:
- Ingresos (30d): $${totalSales30d.toLocaleString('es-AR')}
- Compras (30d): $${totalPurchases30d.toLocaleString('es-AR')}
- Gastos operativos (90d): $${totalExpenses30d.toLocaleString('es-AR')}
- Ganancia bruta estimada: $${grossProfit.toLocaleString('es-AR')}
- Resultado neto estimado: $${netProfit.toLocaleString('es-AR')}
- Cuentas por cobrar: $${totalReceivables.toLocaleString('es-AR')}
- Cuentas por pagar: $${totalPayables.toLocaleString('es-AR')}

🏢 PROVEEDORES:
- Total proveedores activos: ${suppliers.length}
- Compras recientes: ${purchases.length} órdenes

${context ? `CONTEXTO ADICIONAL: ${context}` : ''}
`;

    // Build specific prompts based on type
    let systemPrompt = `Eres un asistente de negocios experto para empresas argentinas. Tu nombre es "Asistente de Gestión".

INSTRUCCIONES IMPORTANTES:
1. Responde SIEMPRE en español argentino, de forma clara y profesional
2. Usa los datos proporcionados para dar respuestas específicas y accionables
3. Cuando des recomendaciones, sé concreto con números y plazos
4. Si detectas problemas urgentes, destácalos al principio de tu respuesta
5. Usa emojis moderadamente para hacer la respuesta más visual
6. Formatea tu respuesta de forma clara con secciones y viñetas
7. No inventes datos - si no tienes información suficiente, indícalo
8. Siempre termina con una recomendación o siguiente paso accionable

CAPACIDADES:
- Análisis de ventas y tendencias
- Gestión de inventario y stock
- Insights de clientes y retención
- Análisis financiero básico
- Predicciones basadas en históricos
- Alertas y problemas urgentes
- Recomendaciones de mejora`;

    switch (type) {
      case 'stock-analysis':
        systemPrompt += `\n\nFOCO ACTUAL: Análisis detallado de inventario. Identifica productos críticos, sugiere cantidades de reposición, detecta productos de baja rotación y optimiza el capital en inventario.`;
        break;
      case 'sales-prediction':
        systemPrompt += `\n\nFOCO ACTUAL: Predicción de ventas. Analiza patrones históricos, identifica tendencias estacionales, proyecta ventas futuras y sugiere acciones para mejorar ingresos.`;
        break;
      case 'customer-insights':
        systemPrompt += `\n\nFOCO ACTUAL: Análisis de clientes. Identifica clientes VIP, detecta riesgo de abandono, analiza patrones de compra y sugiere estrategias de retención/fidelización.`;
        break;
      case 'financial-summary':
        systemPrompt += `\n\nFOCO ACTUAL: Resumen financiero ejecutivo. Presenta el estado financiero actual, identifica oportunidades de ahorro, analiza flujo de caja y sugiere mejoras.`;
        break;
      default:
        systemPrompt += `\n\nResponde la consulta del usuario utilizando los datos del negocio disponibles.`;
    }

    // Build messages array
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: { role: string; content: string }) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Add current query with context
    messages.push({ 
      role: 'user', 
      content: `${businessContext}\n\n---\n\nCONSULTA DEL USUARIO: ${query}` 
    });

    console.log('Sending streaming request to Lovable AI Gateway:', { type, queryLength: query?.length });

    // Make streaming request to OpenAI via Lovable Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 2000,
        stream: true, // Enable streaming
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Límite de solicitudes alcanzado. Intenta de nuevo en unos minutos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos agotados. Por favor, recarga tu cuenta.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorData = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorData);
      throw new Error(`Error de IA: ${aiResponse.status}`);
    }

    // Return SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = aiResponse.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              // Send final event to signal completion
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  continue;
                }

                try {
                  const json = JSON.parse(data);
                  const content = json.choices?.[0]?.delta?.content;
                  
                  if (content) {
                    // Send the token to the client
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.error('Error parsing streaming chunk:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Error en el streaming' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in ai-assistant-stream:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
