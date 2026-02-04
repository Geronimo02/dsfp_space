# Performance & Security Improvements - Phase 3 & 4

## Nuevos Componentes y Hooks

### 1. **useAuth** - Hook de Autenticación Centralizado
Ubicación: `src/hooks/useAuth.ts`

**Características:**
- Cachea datos de usuario con React Query (5 min stale time)
- Previene múltiples llamadas a `getUser()` 
- Manejo automático de eventos de autenticación
- Cleanup robusto de subscripciones

**Uso:**
```tsx
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  
  if (isLoading) return <LoadingState />;
  if (!isAuthenticated) return <Navigate to="/auth" />;
  
  return <div>Hola {user.email}</div>;
}
```

### 2. **DataTable** - Tabla Reutilizable con Paginación
Ubicación: `src/components/ui/data-table.tsx`

**Características:**
- Paginación client-side automática
- Búsqueda integrada
- Ordenamiento por columnas
- Tamaños de página configurables
- Totalmente tipado con TypeScript

**Uso:**
```tsx
import { DataTable, Column } from '@/components/ui/data-table';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

const columns: Column<Product>[] = [
  {
    key: 'name',
    header: 'Nombre',
    render: (item) => item.name,
    sortable: true,
  },
  {
    key: 'price',
    header: 'Precio',
    render: (item) => `$${item.price.toFixed(2)}`,
    sortable: true,
  },
  {
    key: 'stock',
    header: 'Stock',
    render: (item) => item.stock,
    sortable: true,
  },
];

function ProductsList() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  return (
    <DataTable
      data={products || []}
      columns={columns}
      isLoading={isLoading}
      pageSize={20}
      searchPlaceholder="Buscar productos..."
      emptyMessage="No hay productos disponibles"
      actions={(item) => (
        <>
          <Button onClick={() => handleEdit(item)}>Editar</Button>
          <Button onClick={() => handleDelete(item)}>Eliminar</Button>
        </>
      )}
    />
  );
}
```

### 3. **Form Fields** - Campos de Formulario Reutilizables
Ubicación: `src/components/ui/form-fields.tsx`

**Componentes:**
- `InputField` - Input text/number/email/etc
- `TextareaField` - Área de texto
- `SelectField` - Selector dropdown

**Características:**
- Manejo automático de errores
- Labels con asterisco para campos requeridos
- Descripciones opcionales
- Atributos ARIA para accesibilidad

**Uso:**
```tsx
import { InputField, SelectField, TextareaField } from '@/components/ui/form-fields';

function MyForm() {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
  });
  const [errors, setErrors] = useState({});

  return (
    <form>
      <InputField
        label="Nombre del producto"
        value={formData.name}
        onChange={(value) => setFormData({ ...formData, name: value })}
        error={errors.name}
        required
        placeholder="Ingrese el nombre"
      />
      
      <SelectField
        label="Categoría"
        value={formData.category}
        onChange={(value) => setFormData({ ...formData, category: value })}
        options={[
          { value: 'electronics', label: 'Electrónica' },
          { value: 'clothing', label: 'Ropa' },
        ]}
        required
      />
      
      <TextareaField
        label="Descripción"
        value={formData.description}
        onChange={(value) => setFormData({ ...formData, description: value })}
        rows={4}
        description="Descripción detallada del producto"
      />
    </form>
  );
}
```

## Mejoras de Performance

### Subscripciones Realtime Mejoradas

**Archivos actualizados:**
- `src/contexts/CompanyContext.tsx`
- `src/hooks/useActiveModules.ts`

**Mejoras implementadas:**
- ✅ `useRef` para evitar memory leaks
- ✅ Flag `isMountedRef` previene actualizaciones después de unmount
- ✅ Cleanup robusto de canales
- ✅ Prevención de subscripciones duplicadas

**Antes:**
```tsx
useEffect(() => {
  const channel = supabase.channel('my-channel')
    .on('postgres_changes', {}, (payload) => {
      updateData(); // Puede ejecutarse después de unmount
    })
    .subscribe();
    
  return () => {
    channel.unsubscribe(); // Puede no limpiar completamente
  };
}, []);
```

**Ahora:**
```tsx
const channelRef = useRef(null);
const isMountedRef = useRef(true);

useEffect(() => {
  isMountedRef.current = true;
  
  // Limpiar canal anterior si existe
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current);
  }
  
  channelRef.current = supabase.channel('my-channel')
    .on('postgres_changes', {}, (payload) => {
      if (!isMountedRef.current) return; // Previene updates después de unmount
      updateData();
    })
    .subscribe();
    
  return () => {
    isMountedRef.current = false;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };
}, []);
```

### Memoización en ModuleProtectedRoute

**Optimizaciones:**
- ✅ Wrapped con `React.memo()`
- ✅ `useMemo` para cálculos costosos
- ✅ Previene re-renders innecesarios

## Cómo Migrar Componentes Existentes

### Paso 1: Reemplazar Tablas con DataTable

**Antes:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nombre</TableHead>
      <TableHead>Precio</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {filteredData.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.price}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
{/* Paginación manual, búsqueda manual, etc */}
```

**Ahora:**
```tsx
<DataTable
  data={data}
  columns={columns}
  isLoading={isLoading}
  pageSize={20}
/>
```

### Paso 2: Usar useAuth en lugar de múltiples getUser()

**Antes:**
```tsx
const { data: { user } } = await supabase.auth.getUser();
```

**Ahora:**
```tsx
const { user } = useAuth();
```

### Paso 3: Reemplazar Forms con Form Fields

**Antes:**
```tsx
<div className="space-y-2">
  <Label htmlFor="name">Nombre *</Label>
  <Input
    id="name"
    value={name}
    onChange={(e) => setName(e.target.value)}
  />
  {errors.name && <p className="text-destructive">{errors.name}</p>}
</div>
```

**Ahora:**
```tsx
<InputField
  label="Nombre"
  value={name}
  onChange={setName}
  error={errors.name}
  required
/>
```

## Próximos Pasos

1. **Migrar componentes grandes a usar DataTable:**
   - Products.tsx
   - Customers.tsx
   - Sales.tsx
   - Suppliers.tsx

2. **Implementar useAuth en todos los componentes que llaman getUser()**

3. **Agregar tests para los nuevos componentes reutilizables**

4. **Performance profiling con React DevTools**

5. **Considerar lazy loading de tabs/modales pesados**
