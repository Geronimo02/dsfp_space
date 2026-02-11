export type BusinessNiche = "retail" | "gastro" | "services" | "distribution";

export interface ChecklistItem {
  key: string;
  title: string;
  description: string;
  link: string;
  icon: string; // lucide icon name
}

export interface NicheInfo {
  label: string;
  tagline: string;
  items: ChecklistItem[];
}

export const NICHE_OPTIONS: { value: BusinessNiche; label: string; description: string }[] = [
  { value: "retail", label: "Retail / Comercio", description: "Tiendas, kioscos, minimercados" },
  { value: "gastro", label: "Gastronomía", description: "Restaurantes, bares, cafeterías" },
  { value: "services", label: "Servicios profesionales", description: "Consultoras, estudios contables, freelancers" },
  { value: "distribution", label: "Distribución / Mayorista", description: "Distribuidoras, mayoristas" },
];

export const ONBOARDING_CHECKLISTS: Record<BusinessNiche, NicheInfo> = {
  retail: {
    label: "Retail / Comercio",
    tagline: "Ideal para gestionar tu tienda, controlar stock y vender rápido desde el punto de venta.",
    items: [
      { key: "add_product", title: "Cargá tu primer producto", description: "Agregá un producto con precio y stock para empezar a vender.", link: "/products", icon: "Package" },
      { key: "first_sale", title: "Hacé tu primera venta", description: "Usá el punto de venta para registrar una venta rápida.", link: "/pos", icon: "ShoppingCart" },
      { key: "add_customer", title: "Registrá un cliente", description: "Guardá los datos de un cliente para seguimiento y fidelización.", link: "/customers", icon: "UserPlus" },
      { key: "setup_cash", title: "Abrí la caja", description: "Abrí tu primera caja registradora para controlar el efectivo.", link: "/cash-register", icon: "Wallet" },
      { key: "check_reports", title: "Revisá tus reportes", description: "Mirá el resumen de ventas y estado general del negocio.", link: "/reports", icon: "BarChart3" },
    ],
  },
  gastro: {
    label: "Gastronomía",
    tagline: "Perfecto para restaurantes y bares: menú, mesas, caja y control de insumos.",
    items: [
      { key: "add_product", title: "Cargá tu menú", description: "Agregá los platos y bebidas que ofrecés con sus precios.", link: "/products", icon: "UtensilsCrossed" },
      { key: "first_sale", title: "Registrá una venta", description: "Usá el POS para cobrar tu primer pedido.", link: "/pos", icon: "ShoppingCart" },
      { key: "setup_cash", title: "Abrí la caja del día", description: "Abrí caja para controlar ingresos y egresos del turno.", link: "/cash-register", icon: "Wallet" },
      { key: "add_expense", title: "Registrá un gasto", description: "Cargá un gasto operativo como insumos o servicios.", link: "/expenses", icon: "Receipt" },
      { key: "check_reports", title: "Revisá las ventas del día", description: "Mirá cuánto vendiste hoy y el estado de tu caja.", link: "/reports", icon: "BarChart3" },
    ],
  },
  services: {
    label: "Servicios profesionales",
    tagline: "Organizá tu facturación, clientes y seguimiento de trabajos realizados.",
    items: [
      { key: "add_customer", title: "Cargá tu primer cliente", description: "Registrá un cliente para empezar a generar presupuestos.", link: "/customers", icon: "UserPlus" },
      { key: "create_quote", title: "Creá un presupuesto", description: "Generá un presupuesto profesional para enviar a tu cliente.", link: "/quotations", icon: "FileText" },
      { key: "first_sale", title: "Registrá un cobro", description: "Registrá una venta o cobro por tus servicios.", link: "/sales", icon: "DollarSign" },
      { key: "add_expense", title: "Registrá un gasto", description: "Controlá los gastos operativos de tu actividad.", link: "/expenses", icon: "Receipt" },
      { key: "check_reports", title: "Revisá tus números", description: "Analizá ingresos vs egresos y rentabilidad.", link: "/reports", icon: "BarChart3" },
    ],
  },
  distribution: {
    label: "Distribución / Mayorista",
    tagline: "Controlá stock en depósitos, gestión de compras y ventas por mayor.",
    items: [
      { key: "add_product", title: "Cargá tu catálogo", description: "Agregá tus productos con precios mayoristas y stock.", link: "/products", icon: "Package" },
      { key: "add_supplier", title: "Registrá un proveedor", description: "Cargá los datos de un proveedor para gestionar compras.", link: "/suppliers", icon: "Truck" },
      { key: "add_customer", title: "Registrá un cliente", description: "Cargá un cliente mayorista para empezar a facturar.", link: "/customers", icon: "UserPlus" },
      { key: "first_sale", title: "Hacé tu primera venta", description: "Registrá una venta mayorista con tu nuevo catálogo.", link: "/pos", icon: "ShoppingCart" },
      { key: "check_stock", title: "Revisá tu stock", description: "Controlá el inventario y configurá alertas de stock bajo.", link: "/inventory-alerts", icon: "AlertTriangle" },
    ],
  },
};
