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

// ─── helpers ───────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2 });
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
const isoDate = (d: Date) => d.toISOString().split('T')[0];

// ─── Fetch ALL business data in parallel ──────────────
async function fetchBusinessData(sb: any, companyId: string) {
  const d90 = daysAgo(90);
  const d90iso = isoDate(d90);
  const d90ts = d90.toISOString();

  const [
    salesR, productsR, customersR, expensesR, saleItemsR,
    purchasesR, suppliersR, employeesR, commissionsR, commissionTxR,
    quotationsR, techServicesR, warehousesR, whStockR,
    bankAccountsR, bankMovR, cardMovR, checksR,
    cashRegistersR, returnsR, deliveryNotesR,
    payrollR, timeEntriesR, expCatsR,
    reservationsR, promotionsR,
    // ── Wave 2: 14 new sources ──
    salePaymentsR, custPaymentsR, custAccountMovR, creditNotesR,
    purchaseOrdersR, purchaseItemsR, whTransfersR,
    loyaltyTxR, cashMovementsR, crmOpportunitiesR,
    quotationItemsR, returnItemsR, priceListsR, supportTicketsR
  ] = await Promise.all([
    sb.from('sales').select('id, total, payment_method, status, created_at, customer_id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(500),
    sb.from('products').select('id, name, price, cost, stock, min_stock, category, active').eq('company_id', companyId),
    sb.from('customers').select('id, name, total_purchases, current_balance, created_at, loyalty_tier, email, phone').eq('company_id', companyId).limit(200),
    sb.from('expenses').select('amount, category_id, expense_date, description').eq('company_id', companyId).gte('expense_date', d90iso),
    sb.from('sale_items').select('product_id, quantity, subtotal, created_at').eq('company_id', companyId).gte('created_at', d90ts),
    sb.from('purchases').select('total, purchase_date, supplier_id, status').eq('company_id', companyId).gte('purchase_date', d90iso),
    sb.from('suppliers').select('id, name, balance').eq('company_id', companyId).eq('active', true),
    sb.from('employees').select('id, first_name, last_name, position, department, base_salary, hire_date, active, employee_type').eq('company_id', companyId),
    sb.from('commissions').select('id, name, type, value, active').eq('company_id', companyId),
    sb.from('commission_transactions').select('employee_id, commission_amount, sale_id, created_at').eq('company_id', companyId).gte('created_at', d90ts),
    sb.from('quotations').select('id, total, status, valid_until, created_at, customer_id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
    sb.from('technical_services').select('id, status, total, device_type, created_at, customer_id, priority').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
    sb.from('warehouses').select('id, name, is_default').eq('company_id', companyId),
    sb.from('warehouse_stock').select('warehouse_id, product_id, quantity').eq('company_id', companyId),
    sb.from('bank_accounts').select('id, bank_name, account_type, currency, balance').eq('company_id', companyId),
    sb.from('bank_movements').select('id, amount, type, description, movement_date').eq('company_id', companyId).gte('movement_date', d90iso).order('movement_date', { ascending: false }).limit(200),
    sb.from('card_movements').select('id, amount, card_brand, installments, settlement_date, status').eq('company_id', companyId).gte('settlement_date', d90iso).limit(200),
    sb.from('checks').select('id, amount, status, due_date, type').eq('company_id', companyId).limit(100),
    sb.from('cash_registers').select('id, status, opening_amount, closing_amount, opened_at, closed_at').eq('company_id', companyId).order('opened_at', { ascending: false }).limit(30),
    sb.from('returns').select('id, total, reason, status, created_at').eq('company_id', companyId).gte('created_at', d90ts).limit(100),
    sb.from('delivery_notes').select('id, status, created_at').eq('company_id', companyId).gte('created_at', d90ts).limit(100),
    sb.from('payroll_liquidations').select('id, period_start, period_end, total_gross, total_deductions, total_net, status').eq('company_id', companyId).order('period_start', { ascending: false }).limit(12),
    sb.from('employee_time_entries').select('employee_id, check_in, check_out, hours_worked, status').eq('company_id', companyId).gte('check_in', d90ts).limit(500),
    sb.from('expense_categories').select('id, name').eq('company_id', companyId),
    sb.from('reservations').select('id, total, status, created_at').eq('company_id', companyId).gte('created_at', d90ts).limit(100),
    sb.from('promotions').select('id, name, discount_type, discount_value, active, start_date, end_date').eq('company_id', companyId),
    // ── Wave 2 queries ──
    sb.from('sale_payments').select('id, sale_id, amount, payment_method, card_surcharge, installments').eq('company_id', companyId).gte('created_at', d90ts).limit(500),
    sb.from('customer_payments').select('id, customer_id, amount, payment_method, payment_date').eq('company_id', companyId).gte('payment_date', d90iso).limit(300),
    sb.from('customer_account_movements').select('id, customer_id, debit_amount, credit_amount, balance, movement_type, status, due_date, movement_date').eq('company_id', companyId).gte('movement_date', d90iso).order('movement_date', { ascending: false }).limit(500),
    sb.from('credit_notes').select('id, customer_id, amount, used_amount, balance, status, created_at').eq('company_id', companyId).limit(100),
    sb.from('purchase_orders').select('id, supplier_id, total_amount, status, delivery_date, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
    sb.from('purchase_items').select('id, purchase_id, product_id, product_name, quantity, unit_cost, subtotal').eq('company_id', companyId).gte('created_at', d90ts).limit(500),
    sb.from('warehouse_transfers').select('id, from_warehouse_id, to_warehouse_id, status, transfer_date, created_at').eq('company_id', companyId).gte('created_at', d90ts).limit(100),
    sb.from('loyalty_transactions').select('id, customer_id, points, type, description, created_at').eq('company_id', companyId).gte('created_at', d90ts).limit(300),
    sb.from('cash_movements').select('id, cash_register_id, amount, type, category, description, created_at').eq('company_id', companyId).gte('created_at', d90ts).limit(300),
    sb.from('crm_opportunities').select('id, name, customer_id, value, probability, stage, status, expected_revenue, estimated_close_date, source').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
    sb.from('quotation_items').select('id, quotation_id, product_name, quantity, unit_price, subtotal').eq('company_id', companyId).gte('created_at', d90ts).limit(300),
    sb.from('return_items').select('id, return_id, product_name, quantity, unit_price, subtotal').eq('company_id', companyId).gte('created_at', d90ts).limit(200),
    sb.from('price_lists').select('id, name, is_active, is_default').eq('company_id', companyId),
    sb.from('customer_support_tickets').select('id, subject, status, priority, category, created_at, closed_at, first_response_at, sla_response_breached, sla_resolution_breached').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
  ]);

  return {
    sales: salesR.data || [], products: productsR.data || [], customers: customersR.data || [],
    expenses: expensesR.data || [], saleItems: saleItemsR.data || [], purchases: purchasesR.data || [],
    suppliers: suppliersR.data || [], employees: employeesR.data || [],
    commissions: commissionsR.data || [], commissionTx: commissionTxR.data || [],
    quotations: quotationsR.data || [], techServices: techServicesR.data || [],
    warehouses: warehousesR.data || [], whStock: whStockR.data || [],
    bankAccounts: bankAccountsR.data || [], bankMov: bankMovR.data || [],
    cardMov: cardMovR.data || [], checks: checksR.data || [],
    cashRegisters: cashRegistersR.data || [], returns: returnsR.data || [],
    deliveryNotes: deliveryNotesR.data || [], payroll: payrollR.data || [],
    timeEntries: timeEntriesR.data || [], expCats: expCatsR.data || [],
    reservations: reservationsR.data || [], promotions: promotionsR.data || [],
    salePayments: salePaymentsR.data || [], custPayments: custPaymentsR.data || [],
    custAccountMov: custAccountMovR.data || [], creditNotes: creditNotesR.data || [],
    purchaseOrders: purchaseOrdersR.data || [], purchaseItems: purchaseItemsR.data || [],
    whTransfers: whTransfersR.data || [], loyaltyTx: loyaltyTxR.data || [],
    cashMovements: cashMovementsR.data || [], crmOpportunities: crmOpportunitiesR.data || [],
    quotationItems: quotationItemsR.data || [], returnItems: returnItemsR.data || [],
    priceLists: priceListsR.data || [], supportTickets: supportTicketsR.data || [],
  };
}

// ─── Build business context string ───────────────────
function buildBusinessContext(d: any, context?: string) {
  const thirtyDaysAgo = daysAgo(30);
  const sevenDaysAgo = daysAgo(7);

  const recentSales = d.sales.filter((s: any) => new Date(s.created_at) >= thirtyDaysAgo);
  const weekSales = d.sales.filter((s: any) => new Date(s.created_at) >= sevenDaysAgo);
  const totalSales30d = recentSales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
  const totalSales7d = weekSales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
  const avgTicket = recentSales.length > 0 ? totalSales30d / recentSales.length : 0;

  const paymentMethods: Record<string, number> = {};
  recentSales.forEach((s: any) => { paymentMethods[s.payment_method || 'otro'] = (paymentMethods[s.payment_method || 'otro'] || 0) + (s.total || 0); });

  const salesByDow: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  recentSales.forEach((s: any) => { const dow = new Date(s.created_at).getDay(); salesByDow[dow].push(s.total || 0); });
  const dowNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const avgByDow = Object.entries(salesByDow).map(([dow, totals]) => ({
    day: dowNames[parseInt(dow)],
    avg: totals.length > 0 ? totals.reduce((a: number, b: number) => a + b, 0) / totals.length : 0,
  }));

  const prodVel: Record<string, number> = {};
  d.saleItems.forEach((i: any) => { prodVel[i.product_id] = (prodVel[i.product_id] || 0) + i.quantity; });
  const enrichedProducts = d.products.map((p: any) => ({
    ...p, velocity_90d: prodVel[p.id] || 0,
    days_of_stock: prodVel[p.id] ? Math.round((p.stock || 0) / (prodVel[p.id] / 90)) : 999,
    needs_reorder: (p.stock || 0) <= (p.min_stock || 5),
    revenue_90d: (prodVel[p.id] || 0) * (p.price || 0),
  }));
  const lowStock = enrichedProducts.filter((p: any) => p.needs_reorder && p.active);
  const deadStock = enrichedProducts.filter((p: any) => p.velocity_90d === 0 && (p.stock || 0) > 0 && p.active);
  const topProducts = enrichedProducts.filter((p: any) => p.active).sort((a: any, b: any) => b.revenue_90d - a.revenue_90d).slice(0, 10);

  const custMetrics: Record<string, { purchases: number; total: number; lastPurchase: string }> = {};
  d.sales.forEach((s: any) => {
    if (!s.customer_id) return;
    if (!custMetrics[s.customer_id]) custMetrics[s.customer_id] = { purchases: 0, total: 0, lastPurchase: '' };
    custMetrics[s.customer_id].purchases++;
    custMetrics[s.customer_id].total += s.total || 0;
    if (s.created_at > custMetrics[s.customer_id].lastPurchase) custMetrics[s.customer_id].lastPurchase = s.created_at;
  });
  const enrichedCustomers = d.customers.map((c: any) => ({
    ...c, ...custMetrics[c.id],
    daysSinceLastPurchase: custMetrics[c.id]?.lastPurchase
      ? Math.floor((Date.now() - new Date(custMetrics[c.id].lastPurchase).getTime()) / 86400000) : 999,
  })).sort((a: any, b: any) => (b.total || 0) - (a.total || 0));
  const topCustomers = enrichedCustomers.slice(0, 10);
  const inactiveCustomers = enrichedCustomers.filter((c: any) => c.daysSinceLastPurchase > 30 && (c.total || 0) > 0);
  const customersWithDebt = enrichedCustomers.filter((c: any) => (c.current_balance || 0) > 0);

  const totalExpenses = d.expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const totalPurchases = d.purchases.reduce((sum: number, p: any) => sum + (p.total || 0), 0);
  const totalReceivables = d.customers.reduce((sum: number, c: any) => sum + (c.current_balance || 0), 0);
  const totalPayables = d.suppliers.reduce((sum: number, s: any) => sum + (s.balance || 0), 0);
  const grossProfit = totalSales30d - totalPurchases;
  const netProfit = grossProfit - totalExpenses;

  const activeEmployees = d.employees.filter((e: any) => e.active);
  const commissionTotal = d.commissionTx.reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);

  const totalBankBalance = d.bankAccounts.reduce((sum: number, b: any) => sum + (b.balance || 0), 0);
  const pendingChecks = d.checks.filter((c: any) => c.status === 'pending' || c.status === 'cartera');
  const pendingChecksTotal = pendingChecks.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  const pendingCardSettlements = d.cardMov.filter((c: any) => c.status !== 'settled' && c.status !== 'acreditado');
  const pendingCardTotal = pendingCardSettlements.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);

  const openQuotations = d.quotations.filter((q: any) => q.status === 'draft' || q.status === 'sent' || q.status === 'pending');
  const quotationsTotal = openQuotations.reduce((sum: number, q: any) => sum + (q.total || 0), 0);
  const expiredQuotations = d.quotations.filter((q: any) => q.valid_until && new Date(q.valid_until) < new Date() && q.status !== 'accepted' && q.status !== 'invoiced');

  const openServices = d.techServices.filter((t: any) => t.status !== 'completed' && t.status !== 'delivered' && t.status !== 'cancelled');
  const servicesRevenue = d.techServices.filter((t: any) => t.status === 'completed' || t.status === 'delivered').reduce((sum: number, t: any) => sum + (t.total || 0), 0);

  const returnsTotal = d.returns.reduce((sum: number, r: any) => sum + (r.total || 0), 0);
  const lastPayroll = d.payroll.length > 0 ? d.payroll[0] : null;
  const warehouseNames = d.warehouses.map((w: any) => w.name).join(', ');
  const activePromos = d.promotions.filter((p: any) => p.active);

  const expCatMap: Record<string, string> = {};
  d.expCats.forEach((c: any) => { expCatMap[c.id] = c.name; });
  const expByCategory: Record<string, number> = {};
  d.expenses.forEach((e: any) => {
    const catName = expCatMap[e.category_id] || 'Sin categoría';
    expByCategory[catName] = (expByCategory[catName] || 0) + (e.amount || 0);
  });

  const totalHoursWorked = d.timeEntries.reduce((sum: number, t: any) => sum + (t.hours_worked || 0), 0);
  const activeReservations = d.reservations.filter((r: any) => r.status === 'active' || r.status === 'pending' || r.status === 'confirmed');

  // ── Wave 2 calculations ──
  const cardSurcharges = d.salePayments.reduce((sum: number, p: any) => sum + (p.card_surcharge || 0), 0);
  const installmentPayments = d.salePayments.filter((p: any) => (p.installments || 1) > 1);
  const custPaymentsTotal = d.custPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const overdueMovements = d.custAccountMov.filter((m: any) => m.status === 'pending' && m.due_date && new Date(m.due_date) < new Date());
  const overdueTotal = overdueMovements.reduce((sum: number, m: any) => sum + (m.debit_amount || 0), 0);
  const activeCreditNotes = d.creditNotes.filter((cn: any) => (cn.balance || 0) > 0);
  const creditNotesBalance = activeCreditNotes.reduce((sum: number, cn: any) => sum + (cn.balance || 0), 0);
  const openPOs = d.purchaseOrders.filter((po: any) => po.status !== 'received' && po.status !== 'cancelled');
  const openPOsTotal = openPOs.reduce((sum: number, po: any) => sum + (po.total_amount || 0), 0);
  const purchaseByCost = d.purchaseItems.reduce((sum: number, pi: any) => sum + (pi.subtotal || 0), 0);
  const topPurchasedProducts: Record<string, { name: string; qty: number; cost: number }> = {};
  d.purchaseItems.forEach((pi: any) => {
    const name = pi.product_name || pi.product_id;
    if (!topPurchasedProducts[name]) topPurchasedProducts[name] = { name, qty: 0, cost: 0 };
    topPurchasedProducts[name].qty += pi.quantity || 0;
    topPurchasedProducts[name].cost += pi.subtotal || 0;
  });
  const topPurchased = Object.values(topPurchasedProducts).sort((a, b) => b.cost - a.cost).slice(0, 5);
  const pendingTransfers = d.whTransfers.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled');
  const loyaltyEarned = d.loyaltyTx.filter((t: any) => t.type === 'earn' || t.type === 'credit').reduce((sum: number, t: any) => sum + (t.points || 0), 0);
  const loyaltyRedeemed = d.loyaltyTx.filter((t: any) => t.type === 'redeem' || t.type === 'debit').reduce((sum: number, t: any) => sum + Math.abs(t.points || 0), 0);
  const cashInflows = d.cashMovements.filter((m: any) => m.type === 'income' || m.type === 'ingreso').reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
  const cashOutflows = d.cashMovements.filter((m: any) => m.type === 'expense' || m.type === 'egreso').reduce((sum: number, m: any) => sum + (m.amount || 0), 0);
  const openOpportunities = d.crmOpportunities.filter((o: any) => o.status === 'open' || o.status === 'active');
  const pipelineValue = openOpportunities.reduce((sum: number, o: any) => sum + (o.value || 0), 0);
  const weightedPipeline = openOpportunities.reduce((sum: number, o: any) => sum + ((o.value || 0) * (o.probability || 0) / 100), 0);
  const wonOpps = d.crmOpportunities.filter((o: any) => o.status === 'won');
  const lostOpps = d.crmOpportunities.filter((o: any) => o.status === 'lost');
  const quotedProducts: Record<string, { name: string; qty: number; revenue: number }> = {};
  d.quotationItems.forEach((qi: any) => {
    const name = qi.product_name || 'Sin nombre';
    if (!quotedProducts[name]) quotedProducts[name] = { name, qty: 0, revenue: 0 };
    quotedProducts[name].qty += qi.quantity || 0;
    quotedProducts[name].revenue += qi.subtotal || 0;
  });
  const topQuotedProducts = Object.values(quotedProducts).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const returnedProducts: Record<string, { name: string; qty: number; total: number }> = {};
  d.returnItems.forEach((ri: any) => {
    const name = ri.product_name || 'Sin nombre';
    if (!returnedProducts[name]) returnedProducts[name] = { name, qty: 0, total: 0 };
    returnedProducts[name].qty += ri.quantity || 0;
    returnedProducts[name].total += ri.subtotal || 0;
  });
  const topReturnedProducts = Object.values(returnedProducts).sort((a, b) => b.total - a.total).slice(0, 5);
  const openTickets = d.supportTickets.filter((t: any) => t.status !== 'closed' && t.status !== 'resolved');
  const slaBreaches = d.supportTickets.filter((t: any) => t.sla_response_breached || t.sla_resolution_breached);
  const activePriceLists = d.priceLists.filter((pl: any) => pl.is_active);

  return `
=== DATOS DEL NEGOCIO EN TIEMPO REAL ===
Fecha actual: ${new Date().toLocaleDateString('es-AR')}

── VENTAS (últimos 30 días) ──
- Total ventas: $${fmt(totalSales30d)}
- Ventas últimos 7 días: $${fmt(totalSales7d)}
- Transacciones (30d): ${recentSales.length} | (7d): ${weekSales.length}
- Ticket promedio: $${fmt(avgTicket)}
- Métodos de pago: ${Object.entries(paymentMethods).map(([m, v]) => `${m}: $${fmt(v)}`).join(', ') || 'N/A'}
- Promedio por día: ${avgByDow.map(d => `${d.day}: $${fmt(d.avg)}`).join(' | ')}

── INVENTARIO ──
- Productos activos: ${d.products.filter((p: any) => p.active).length} | Inactivos: ${d.products.filter((p: any) => !p.active).length}
- Stock bajo (${lowStock.length}): ${lowStock.slice(0, 8).map((p: any) => `${p.name} (${p.stock}/${p.min_stock})`).join(', ') || 'Ninguno'}
- Sin movimiento 90d (${deadStock.length}): ${deadStock.slice(0, 5).map((p: any) => `${p.name} (${p.stock}u)`).join(', ') || 'Ninguno'}
- Top productos: ${topProducts.slice(0, 7).map((p: any) => `${p.name} ($${fmt(p.revenue_90d)}, ${p.velocity_90d}u vendidas)`).join(', ')}
- Depósitos: ${warehouseNames || 'No configurados'}

── CLIENTES ──
- Registrados: ${d.customers.length}
- Top clientes: ${topCustomers.slice(0, 5).map((c: any) => `${c.name} ($${fmt(c.total || 0)}, ${c.purchases || 0} compras)`).join(', ')}
- Inactivos >30d: ${inactiveCustomers.length}
- Con deuda: ${customersWithDebt.length} (Total: $${fmt(totalReceivables)})

── FINANZAS ──
- Ingresos (30d): $${fmt(totalSales30d)} | Compras (90d): $${fmt(totalPurchases)} | Gastos (90d): $${fmt(totalExpenses)}
- Ganancia bruta estimada (30d): $${fmt(grossProfit)}
- Resultado neto estimado: $${fmt(netProfit)}
- Cuentas por cobrar: $${fmt(totalReceivables)} | Cuentas por pagar: $${fmt(totalPayables)}
- Gastos por categoría: ${Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) => `${c}: $${fmt(v)}`).join(', ') || 'N/A'}

── TESORERÍA ──
- Saldo en bancos: $${fmt(totalBankBalance)} (${d.bankAccounts.length} cuentas)
- Cheques pendientes: ${pendingChecks.length} por $${fmt(pendingChecksTotal)}
- Tarjetas por acreditar: ${pendingCardSettlements.length} por $${fmt(pendingCardTotal)}
- Cuentas bancarias: ${d.bankAccounts.map((b: any) => `${b.bank_name} (${b.currency}): $${fmt(b.balance || 0)}`).join(', ') || 'N/A'}

── RRHH ──
- Empleados activos: ${activeEmployees.length}
- Empleados: ${activeEmployees.slice(0, 10).map((e: any) => `${e.first_name} ${e.last_name} (${e.position || e.department || 'sin cargo'})`).join(', ')}
- Comisiones últimos 90d: $${fmt(commissionTotal)} (${d.commissionTx.length} transacciones)
- Reglas de comisión activas: ${d.commissions.filter((c: any) => c.active).length}
- Horas trabajadas (90d): ${totalHoursWorked.toFixed(1)}h
- Última liquidación: ${lastPayroll ? `${lastPayroll.period_start} a ${lastPayroll.period_end} | Bruto: $${fmt(lastPayroll.total_gross || 0)} | Neto: $${fmt(lastPayroll.total_net || 0)} | Estado: ${lastPayroll.status}` : 'Sin liquidaciones'}

── COTIZACIONES ──
- Abiertas: ${openQuotations.length} por $${fmt(quotationsTotal)}
- Vencidas: ${expiredQuotations.length}

── SERVICIOS TÉCNICOS ──
- Abiertos: ${openServices.length}
- Ingresos por servicios (completados): $${fmt(servicesRevenue)}

── DEVOLUCIONES (90d) ──
- Total: ${d.returns.length} por $${fmt(returnsTotal)}

── RESERVAS ──
- Activas: ${activeReservations.length}

── PROMOCIONES ──
- Activas: ${activePromos.length}: ${activePromos.slice(0, 5).map((p: any) => `${p.name} (${p.discount_type}: ${p.discount_value})`).join(', ') || 'Ninguna'}

── PROVEEDORES ──
- Activos: ${d.suppliers.length} | Compras (90d): ${d.purchases.length} órdenes

── CAJA ──
- Última caja: ${d.cashRegisters.length > 0 ? `Apertura: $${fmt(d.cashRegisters[0].opening_amount || 0)} | Cierre: $${fmt(d.cashRegisters[0].closing_amount || 0)} | Estado: ${d.cashRegisters[0].status}` : 'N/A'}
- Movimientos caja (90d): Ingresos $${fmt(cashInflows)} | Egresos $${fmt(cashOutflows)} | Neto $${fmt(cashInflows - cashOutflows)}

── PAGOS Y CUENTA CORRIENTE ──
- Cobros a clientes (90d): $${fmt(custPaymentsTotal)} en ${d.custPayments.length} pagos
- Recargos tarjeta (90d): $${fmt(cardSurcharges)} | Pagos en cuotas: ${installmentPayments.length}
- Movimientos vencidos: ${overdueMovements.length} por $${fmt(overdueTotal)}
- Notas de crédito activas: ${activeCreditNotes.length} con saldo $${fmt(creditNotesBalance)}

── COMPRAS DETALLE ──
- Órdenes de compra abiertas: ${openPOs.length} por $${fmt(openPOsTotal)}
- Costo compras detallado (90d): $${fmt(purchaseByCost)}
- Productos más comprados: ${topPurchased.map(p => `${p.name} (${p.qty}u, $${fmt(p.cost)})`).join(', ') || 'N/A'}

── TRANSFERENCIAS DEPÓSITO ──
- Pendientes: ${pendingTransfers.length}
- Total transferencias (90d): ${d.whTransfers.length}

── FIDELIZACIÓN ──
- Puntos otorgados (90d): ${loyaltyEarned} | Canjeados: ${loyaltyRedeemed}
- Transacciones: ${d.loyaltyTx.length}

── CRM / PIPELINE ──
- Oportunidades abiertas: ${openOpportunities.length} por $${fmt(pipelineValue)}
- Pipeline ponderado: $${fmt(weightedPipeline)}
- Ganadas: ${wonOpps.length} | Perdidas: ${lostOpps.length}
- Fuentes: ${[...new Set(d.crmOpportunities.map((o: any) => o.source).filter(Boolean))].join(', ') || 'N/A'}

── PRODUCTOS MÁS COTIZADOS ──
- ${topQuotedProducts.map(p => `${p.name} (${p.qty}u, $${fmt(p.revenue)})`).join(', ') || 'N/A'}

── PRODUCTOS MÁS DEVUELTOS ──
- ${topReturnedProducts.map(p => `${p.name} (${p.qty}u, $${fmt(p.total)})`).join(', ') || 'N/A'}

── SOPORTE CLIENTES ──
- Tickets abiertos: ${openTickets.length} | Total (recientes): ${d.supportTickets.length}
- SLA incumplidos: ${slaBreaches.length}
- Prioridad alta: ${d.supportTickets.filter((t: any) => t.priority === 'high' || t.priority === 'urgent').length}

── LISTAS DE PRECIOS ──
- Activas: ${activePriceLists.length}: ${activePriceLists.map((pl: any) => pl.name).join(', ') || 'Ninguna'}

${context ? `── CONTEXTO ADICIONAL ──\n${context}` : ''}
`;
}

// ─── Build system prompt ─────────────────────────────
function buildSystemPrompt(type: string, lastAssistantSummary?: string) {
  let prompt = `Eres el asistente IA de gestión de Ventify, plataforma enterprise para empresas argentinas.

ROL: Analista de datos de negocio con expertise en retail, comercio, distribución y servicios.

REGLAS:
1. Responde SIEMPRE en español argentino, tono ejecutivo y profesional
2. Estructura: Resumen Ejecutivo (2-3 líneas) → Insights (2-5 bullets con números) → Recomendación concreta → Próximo paso
3. Sustentá TODO con los datos reales. Si no hay datos, decilo
4. Destacá riesgos urgentes al inicio
5. Incluí siempre KPIs en cada insight
6. Sé específico: producto, monto, plazo, acción concreta
7. No inventes datos — si necesitás más info, pedí 1 pregunta puntual
8. Evitá redundancia con respuestas previas
9. Alterná estructura para no clonar respuestas

CAPACIDADES:
- Ventas: tendencias, proyección, ticket promedio, métodos de pago, mejor día
- Inventario: stock crítico, rotación, dead stock, días de stock, reposición
- Clientes: segmentación, VIP, riesgo abandono, deuda, frecuencia
- Finanzas: P&L, cashflow, cuentas por cobrar/pagar, gastos por categoría
- Tesorería: saldos bancarios, cheques, tarjetas pendientes
- RRHH: dotación, comisiones, horas trabajadas, costo laboral, nómina
- Cotizaciones: pipeline comercial, vencidas, conversión
- Servicios técnicos: órdenes abiertas, ingresos, prioridades
- Devoluciones: tendencia, montos, impacto, productos más devueltos
- Promociones: efectividad, activas, sugerencias
- Pagos: cobros a clientes, recargos tarjeta, cuotas, movimientos vencidos
- Cuenta corriente: saldos, vencimientos, notas de crédito
- Compras detalle: órdenes abiertas, costo por producto, proveedores top
- CRM/Pipeline: oportunidades, valor ponderado, fuentes, conversión
- Fidelización: puntos otorgados vs canjeados
- Soporte: tickets abiertos, SLA, prioridades
- Listas de precios: activas, por defecto
- Transferencias: movimientos entre depósitos

ACCIONES: Cuando sugieras navegar a una sección, insertá al final:
[ACTION:{"action":"navigate","path":"/ruta"}]
Rutas disponibles: /inventory-alerts, /reports, /accounts-receivable, /quotations, /technical-services, /cash-register, /employees, /commissions, /payroll, /expenses, /promotions, /returns, /warehouses, /bank-accounts, /suppliers, /customers, /products, /sales, /purchase-orders, /crm, /customer-support

Ejemplos:
- Ver proveedores: {"action": "navigate", "path": "/suppliers"}
- Ver clientes: {"action": "navigate", "path": "/customers"}
- Ver productos: {"action": "navigate", "path": "/products"}
- Ver ventas: {"action": "navigate", "path": "/sales"}
- Ver órdenes de compra: {"action": "navigate", "path": "/purchase-orders"}
- Ver CRM pipeline: {"action": "navigate", "path": "/crm"}
- Ver soporte: {"action": "navigate", "path": "/customer-support"}
- Ver fidelización: {"action": "navigate", "path": "/customers"}`;

  if (lastAssistantSummary) {
    prompt += `\n\nRESUMEN ÚLTIMA RESPUESTA (evitar repetir): ${lastAssistantSummary}`;
  }

  switch (type) {
    case 'stock-analysis':
      prompt += `\n\nFOCO: Inventario. Productos críticos, reposición basada en velocidad, dead stock, capital inmovilizado.`;
      break;
    case 'sales-prediction':
      prompt += `\n\nFOCO: Predicción de ventas. Patrones recientes, tendencia 7d vs 30d, proyección semana, supuestos.`;
      break;
    case 'customer-insights':
      prompt += `\n\nFOCO: Clientes. VIP, riesgo abandono, valor de vida, tácticas retención.`;
      break;
    case 'financial-summary':
      prompt += `\n\nFOCO: Finanzas. P&L ejecutivo, cashflow, cobrar/pagar, cheques/tarjetas, gastos, recomendación.`;
      break;
    case 'hr-analysis':
      prompt += `\n\nFOCO: RRHH. Dotación, costo laboral, comisiones, productividad, última liquidación.`;
      break;
    case 'treasury':
      prompt += `\n\nFOCO: Tesorería. Saldos, cheques, tarjetas, flujo proyectado.`;
      break;
    case 'crm-pipeline':
      prompt += `\n\nFOCO: CRM y Pipeline comercial. Oportunidades abiertas, valor ponderado, tasa de conversión won/lost, fuentes de leads, próximos cierres.`;
      break;
    case 'accounts-analysis':
      prompt += `\n\nFOCO: Cuenta corriente. Cobros, vencimientos, notas de crédito, antigüedad de saldos, riesgo incobrabilidad.`;
      break;
    case 'procurement':
      prompt += `\n\nFOCO: Compras y abastecimiento. Órdenes pendientes, costo por producto, proveedores principales, cumplimiento entregas.`;
      break;
    case 'support-analysis':
      prompt += `\n\nFOCO: Soporte al cliente. Tickets abiertos, SLA cumplimiento, categorías más frecuentes, prioridades, tiempos de respuesta.`;
      break;
    default:
      prompt += `\n\nRespondé usando todos los datos disponibles. Priorizá insights accionables.`;
  }

  return prompt;
}

// ─── Summarize last assistant message ─────────────────
function summarizeLastAssistant(history?: { role: string; content: string }[]) {
  if (!history || !Array.isArray(history)) return '';
  const last = [...history].reverse().find(m => m.role === 'assistant');
  if (!last?.content) return '';
  const cleaned = last.content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/#+\s*/g, '').replace(/\n{2,}/g, '\n').trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2);
  return sentences.length > 0 ? sentences.join(' ').slice(0, 320) : '';
}

// ─── Main handler ─────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, type, companyId, context, conversationHistory } = await req.json();

    if (companyId) {
      const { data: membership } = await supabaseClient
        .from('company_users').select('id')
        .eq('user_id', user.id).eq('company_id', companyId).eq('active', true).maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: 'Acceso denegado a esta empresa' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurada');

    // Fetch all business data
    const bizData = await fetchBusinessData(supabaseClient, companyId);
    const businessContext = buildBusinessContext(bizData, context);
    const lastSummary = summarizeLastAssistant(conversationHistory);
    const systemPrompt = buildSystemPrompt(type, lastSummary);

    // Build messages
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg: { role: string; content: string }) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    messages.push({
      role: 'user',
      content: `${businessContext}\n\n---\n\nCONSULTA: ${query}`,
    });

    console.log('AI Stream request:', { type, queryLen: query?.length, tables: Object.keys(bizData).length });

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages, max_tokens: 3000, stream: true }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: 'Límite alcanzado. Intenta en unos minutos.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: 'Créditos agotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

        if (!reader) { controller.close(); return; }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

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
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e) {
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
