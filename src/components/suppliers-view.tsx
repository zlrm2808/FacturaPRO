'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatBs, formatDate, getStatusColor } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Truck,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  Eye,
  X,
  ClipboardList,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// Types
interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  rncCedula: string | null
  contactName: string | null
  status: string
  orderCount: number
  createdAt: string
}

interface PurchaseOrderItem {
  id: string
  productId: string
  product: { id: string; name: string; code: string }
  quantity: number
  unitPrice: number
  subtotal: number
  received: number
}

interface PurchaseOrder {
  id: string
  number: string
  date: string
  subtotal: number
  tax: number
  total: number
  totalBs: number
  dollarRate: number
  status: string
  notes: string | null
  supplierId: string
  supplier: { id: string; name: string; phone: string | null }
  user: { id: string; name: string }
  items: PurchaseOrderItem[]
  createdAt: string
}

interface SupplierFormData {
  name: string
  phone: string
  email: string
  address: string
  rncCedula: string
  contactName: string
  status: string
}

interface OrderItemInput {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

const emptySupplierForm: SupplierFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  rncCedula: '',
  contactName: '',
  status: 'ACTIVO',
}

const PO_STATUS_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  RECIBIDA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  PARCIAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  ANULADA: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

export function SuppliersView() {
  const queryClient = useQueryClient()

  // ============ SUPPLIER STATE ============
  const [supplierSearch, setSupplierSearch] = useState('')
  const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('')
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierFormData>(emptySupplierForm)
  const [viewSupplierOrders, setViewSupplierOrders] = useState<Supplier | null>(null)

  // ============ PURCHASE ORDER STATE ============
  const [poStatusFilter, setPoStatusFilter] = useState('')
  const [poDialogOpen, setPoDialogOpen] = useState(false)
  const [poDetailOpen, setPoDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [poSupplierId, setPoSupplierId] = useState('')
  const [poNotes, setPoNotes] = useState('')
  const [poItems, setPoItems] = useState<OrderItemInput[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [supplierSearchSelect, setSupplierSearchSelect] = useState('')

  // ============ SUPPLIER QUERIES ============
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers', debouncedSupplierSearch],
    queryFn: () => {
      const params = debouncedSupplierSearch ? `?search=${encodeURIComponent(debouncedSupplierSearch)}` : ''
      return api.get(`/suppliers${params}`)
    },
  })

  // Debounce supplier search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSupplierSearch = useCallback(
    (value: string) => {
      setSupplierSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setDebouncedSupplierSearch(value)
      }, 400)
    },
    []
  )

  // ============ PURCHASE ORDER QUERIES ============
  const { data: purchaseOrders = [], isLoading: poLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase-orders', poStatusFilter],
    queryFn: () => {
      const params = poStatusFilter ? `?status=${poStatusFilter}` : ''
      return api.get(`/purchase-orders${params}`)
    },
  })

  // Products for purchase order items
  const { data: products = [] } = useQuery({
    queryKey: ['products-po-search', productSearch],
    queryFn: () => {
      const params = productSearch ? `?search=${encodeURIComponent(productSearch)}` : ''
      return api.get(`/products${params}`)
    },
    enabled: showProductSearch,
  })

  // Suppliers for PO supplier select
  const { data: allSuppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers', ''],
    queryFn: () => api.get('/suppliers'),
  })

  // Dollar rate for new PO dialog
  const { data: dollarRateData } = useQuery({
    queryKey: ['dollar-rate-today'],
    queryFn: () => api.get('/dollar-rates?action=effective'),
    refetchInterval: 300000,
  })
  const currentDollarRate = dollarRateData?.officialRate || 0

  // ============ SUPPLIER MUTATIONS ============
  const createSupplierMutation = useMutation({
    mutationFn: (data: SupplierFormData) => api.post('/suppliers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Proveedor creado exitosamente')
      closeSupplierDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear proveedor')
    },
  })

  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SupplierFormData }) =>
      api.put(`/suppliers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Proveedor actualizado exitosamente')
      closeSupplierDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar proveedor')
    },
  })

  const deleteSupplierMutation = useMutation({
    mutationFn: (id: string) => api.del(`/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Proveedor eliminado exitosamente')
      setDeleteSupplier(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar proveedor')
    },
  })

  // ============ PURCHASE ORDER MUTATIONS ============
  const createPOMutation = useMutation({
    mutationFn: (data: { supplierId: string; items: OrderItemInput[]; notes: string }) =>
      api.post('/purchase-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Orden de compra creada exitosamente')
      closePODialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear orden de compra')
    },
  })

  const receivePOMutation = useMutation({
    mutationFn: (id: string) =>
      api.put(`/purchase-orders/${id}`, { action: 'receive' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSelectedOrder(null)
      setPoDetailOpen(false)
      const stockUpdates = result?.stockUpdates || []
      if (stockUpdates.length > 0) {
        toast.success(
          `Orden recibida. Stock actualizado: ${stockUpdates.map((u: { productName: string; quantityAdded: number; newStock: number }) => `${u.productName} +${u.quantityAdded}`).join(', ')}`
        )
      } else {
        toast.success('Orden recibida exitosamente')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al recibir orden')
    },
  })

  const cancelPOMutation = useMutation({
    mutationFn: (id: string) =>
      api.put(`/purchase-orders/${id}`, { action: 'cancel' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      setSelectedOrder(null)
      setPoDetailOpen(false)
      toast.success('Orden anulada exitosamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al anular orden')
    },
  })

  // ============ SUPPLIER DIALOG HANDLERS ============
  const openNewSupplierDialog = () => {
    setEditingSupplier(null)
    setSupplierForm(emptySupplierForm)
    setSupplierDialogOpen(true)
  }

  const openEditSupplierDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      rncCedula: supplier.rncCedula || '',
      contactName: supplier.contactName || '',
      status: supplier.status,
    })
    setSupplierDialogOpen(true)
  }

  const closeSupplierDialog = () => {
    setSupplierDialogOpen(false)
    setEditingSupplier(null)
    setSupplierForm(emptySupplierForm)
  }

  const handleSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierForm.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (editingSupplier) {
      updateSupplierMutation.mutate({ id: editingSupplier.id, data: supplierForm })
    } else {
      createSupplierMutation.mutate(supplierForm)
    }
  }

  // ============ PO DIALOG HANDLERS ============
  const openNewPODialog = () => {
    setPoSupplierId('')
    setPoNotes('')
    setPoItems([])
    setPoDialogOpen(true)
  }

  const closePODialog = () => {
    setPoDialogOpen(false)
    setPoSupplierId('')
    setPoNotes('')
    setPoItems([])
    setProductSearch('')
    setShowProductSearch(false)
  }

  const addProductToOrder = (product: { id: string; name: string; salePrice: number; purchasePrice: number }) => {
    if (poItems.some((item) => item.productId === product.id)) {
      toast.warning('Este producto ya está en la orden')
      return
    }
    setPoItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.purchasePrice || product.salePrice || 0,
      },
    ])
    setShowProductSearch(false)
    setProductSearch('')
  }

  const removeProductFromOrder = (index: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateOrderItem = (index: number, field: 'quantity' | 'unitPrice', value: number) => {
    setPoItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    )
  }

  const handlePOSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!poSupplierId) {
      toast.error('Seleccione un proveedor')
      return
    }
    if (poItems.length === 0) {
      toast.error('Agregue al menos un producto')
      return
    }
    const validItems = poItems.every((item) => item.quantity > 0 && item.unitPrice > 0)
    if (!validItems) {
      toast.error('Todos los items deben tener cantidad y precio mayor a 0')
      return
    }
    createPOMutation.mutate({
      supplierId: poSupplierId,
      items: poItems,
      notes: poNotes,
    })
  }

  // PO calculations
  const poSubtotal = poItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const poTax = poSubtotal * 0.16
  const poTotal = poSubtotal + poTax
  const poTotalBs = useMemo(() => poTotal * currentDollarRate, [poTotal, currentDollarRate])

  // Open PO detail
  const openPODetail = (order: PurchaseOrder) => {
    setSelectedOrder(order)
    setPoDetailOpen(true)
  }

  const isSupplierMutating = createSupplierMutation.isPending || updateSupplierMutation.isPending

  // Filter suppliers for search select
  const filteredAllSuppliers = supplierSearchSelect
    ? allSuppliers.filter((s) =>
        s.name.toLowerCase().includes(supplierSearchSelect.toLowerCase()) ||
        (s.phone && s.phone.includes(supplierSearchSelect)) ||
        (s.rncCedula && s.rncCedula.includes(supplierSearchSelect))
      )
    : allSuppliers

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Truck className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Proveedores</h1>
            <p className="text-sm text-muted-foreground">
              Gestión de proveedores y órdenes de compra
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={openNewSupplierDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="size-4 mr-2" />
            Nuevo Proveedor
          </Button>
          <Button
            onClick={openNewPODialog}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
          >
            <ClipboardList className="size-4 mr-2" />
            Nueva Orden de Compra
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar proveedor por nombre, teléfono, email, RNC..."
          value={supplierSearch}
          onChange={(e) => handleSupplierSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="suppliers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          <TabsTrigger value="purchase-orders">Órdenes de Compra</TabsTrigger>
        </TabsList>

        {/* ==================== SUPPLIERS TAB ==================== */}
        <TabsContent value="suppliers">
          <div className="rounded-lg border bg-card">
            {suppliersLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : suppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Truck className="size-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-muted-foreground">
                  No se encontraron proveedores
                </p>
                <p className="mt-1 text-sm text-muted-foreground/70">
                  {debouncedSupplierSearch
                    ? 'Intenta con otro término de búsqueda'
                    : 'Agrega tu primer proveedor haciendo clic en "Nuevo Proveedor"'}
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-360px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden md:table-cell">Contacto</TableHead>
                      <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                      <TableHead className="hidden xl:table-cell">Email</TableHead>
                      <TableHead className="hidden sm:table-cell">RNC</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {supplier.contactName || '-'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {supplier.phone || '-'}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-muted-foreground">
                          {supplier.email || '-'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {supplier.rncCedula || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(supplier.status)}>
                            {supplier.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditSupplierDialog(supplier)}
                              title="Editar"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewSupplierOrders(supplier)}
                              title="Ver Órdenes"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteSupplier(supplier)}
                              title="Eliminar"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        {/* ==================== PURCHASE ORDERS TAB ==================== */}
        <TabsContent value="purchase-orders" className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={poStatusFilter === '' ? 'default' : 'outline'}
              onClick={() => setPoStatusFilter('')}
            >
              Todas
            </Button>
            <Button
              size="sm"
              variant={poStatusFilter === 'PENDIENTE' ? 'default' : 'outline'}
              onClick={() => setPoStatusFilter('PENDIENTE')}
            >
              Pendientes
            </Button>
            <Button
              size="sm"
              variant={poStatusFilter === 'RECIBIDA' ? 'default' : 'outline'}
              onClick={() => setPoStatusFilter('RECIBIDA')}
            >
              Recibidas
            </Button>
            <Button
              size="sm"
              variant={poStatusFilter === 'ANULADA' ? 'default' : 'outline'}
              onClick={() => setPoStatusFilter('ANULADA')}
            >
              Anuladas
            </Button>
          </div>

          <div className="rounded-lg border bg-card">
            {poLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ClipboardList className="size-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-muted-foreground">
                  No se encontraron órdenes de compra
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-420px)]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="hidden md:table-cell">Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="hidden lg:table-cell text-right">Total Bs</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.number}</TableCell>
                        <TableCell>{order.supplier.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {formatDate(order.date)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.total)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-right text-muted-foreground text-xs">
                          {order.totalBs > 0 ? formatBs(order.totalBs) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={PO_STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openPODetail(order)}
                              title="Ver Detalle"
                            >
                              <Eye className="size-4" />
                            </Button>
                            {order.status === 'PENDIENTE' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => receivePOMutation.mutate(order.id)}
                                title="Recibir Orden"
                                className="text-emerald-600 hover:text-emerald-700"
                                disabled={receivePOMutation.isPending}
                              >
                                <CheckCircle className="size-4" />
                              </Button>
                            )}
                            {(order.status === 'PENDIENTE' || order.status === 'PARCIAL') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelPOMutation.mutate(order.id)}
                                title="Anular Orden"
                                className="text-destructive hover:text-destructive"
                                disabled={cancelPOMutation.isPending}
                              >
                                <XCircle className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================== NEW/EDIT SUPPLIER DIALOG ==================== */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSupplierSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </DialogTitle>
              <DialogDescription>
                {editingSupplier
                  ? 'Modifica los datos del proveedor'
                  : 'Ingresa los datos del nuevo proveedor'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="supplier-name">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="supplier-name"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Nombre del proveedor"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supplier-phone">Teléfono</Label>
                  <Input
                    id="supplier-phone"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="809-000-0000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier-email">Email</Label>
                  <Input
                    id="supplier-email"
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier-address">Dirección</Label>
                <Input
                  id="supplier-address"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Dirección del proveedor"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supplier-rnc">RNC/Cédula</Label>
                  <Input
                    id="supplier-rnc"
                    value={supplierForm.rncCedula}
                    onChange={(e) => setSupplierForm({ ...supplierForm, rncCedula: e.target.value })}
                    placeholder="000-0000000-0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier-contact">Nombre del Contacto</Label>
                  <Input
                    id="supplier-contact"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                    placeholder="Persona de contacto"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select
                  value={supplierForm.status}
                  onValueChange={(value) => setSupplierForm({ ...supplierForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                    <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeSupplierDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSupplierMutating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSupplierMutating && <Loader2 className="size-4 animate-spin mr-2" />}
                {editingSupplier ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE SUPPLIER DIALOG ==================== */}
      <AlertDialog open={!!deleteSupplier} onOpenChange={(open) => !open && setDeleteSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el proveedor{' '}
              <strong>{deleteSupplier?.name}</strong>.
              {deleteSupplier && deleteSupplier.orderCount > 0 && (
                <span className="mt-2 block rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  ⚠️ Este proveedor tiene {deleteSupplier.orderCount} orden(es) de compra asociada(s). No se puede eliminar hasta que se eliminen las órdenes dependientes.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSupplier && deleteSupplierMutation.mutate(deleteSupplier.id)}
              disabled={deleteSupplierMutation.isPending || (deleteSupplier?.orderCount ?? 0) > 0}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteSupplierMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== VIEW SUPPLIER ORDERS DIALOG ==================== */}
      <Dialog open={!!viewSupplierOrders} onOpenChange={(open) => !open && setViewSupplierOrders(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Órdenes de Compra - {viewSupplierOrders?.name}
            </DialogTitle>
            <DialogDescription>
              Historial de órdenes de compra del proveedor
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {viewSupplierOrders && (() => {
              const supplierOrders = purchaseOrders.filter(
                (o) => o.supplierId === viewSupplierOrders.id
              )
              return supplierOrders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay órdenes de compra para este proveedor
                </p>
              ) : (
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Total Bs</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplierOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.number}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(order.date)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(order.total)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {order.totalBs > 0 ? formatBs(order.totalBs) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={PO_STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}>
                              {order.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== NEW PURCHASE ORDER DIALOG ==================== */}
      <Dialog open={poDialogOpen} onOpenChange={setPoDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Nueva Orden de Compra</DialogTitle>
            <DialogDescription>
              Seleccione un proveedor y agregue productos a la orden
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePOSubmit}>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid gap-4 py-4">
                {/* Supplier Selection */}
                <div className="grid gap-2">
                  <Label>Proveedor <span className="text-destructive">*</span></Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Buscar proveedor..."
                      value={supplierSearchSelect}
                      onChange={(e) => setSupplierSearchSelect(e.target.value)}
                    />
                    <Select value={poSupplierId} onValueChange={setPoSupplierId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proveedor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredAllSuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.phone ? `- ${s.phone}` : ''} {s.rncCedula ? `- ${s.rncCedula}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Product Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Productos</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowProductSearch(!showProductSearch)}
                    >
                      <Plus className="size-4 mr-1" />
                      Agregar Producto
                    </Button>
                  </div>

                  {showProductSearch && (
                    <Card>
                      <CardContent className="p-3 space-y-2">
                        <Input
                          placeholder="Buscar producto por nombre o código..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                        />
                        {products.length > 0 && (
                          <ScrollArea className="max-h-40">
                            <div className="space-y-1">
                              {products
                                .filter((p: { id: string }) => !poItems.some((item) => item.productId === p.id))
                                .slice(0, 10)
                                .map((product: { id: string; name: string; code: string; salePrice: number; purchasePrice: number }) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => addProductToOrder(product)}
                                    className="w-full text-left p-2 rounded-md hover:bg-accent transition-colors text-sm flex justify-between items-center"
                                  >
                                    <span>
                                      <span className="font-medium">{product.name}</span>
                                      <span className="text-muted-foreground ml-2">({product.code})</span>
                                    </span>
                                    <span className="text-muted-foreground">
                                      {formatCurrency(product.purchasePrice || product.salePrice)}
                                    </span>
                                  </button>
                                ))}
                            </div>
                          </ScrollArea>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {poItems.length > 0 && (
                    <div className="space-y-2">
                      {poItems.map((item, index) => (
                        <div
                          key={item.productId}
                          className="flex items-center gap-2 p-2 rounded-md border"
                        >
                          <Package className="size-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium flex-1 min-w-0 truncate">
                            {item.productName}
                          </span>
                          <Input
                            type="number"
                            placeholder="Cant."
                            value={item.quantity}
                            onChange={(e) =>
                              updateOrderItem(index, 'quantity', parseInt(e.target.value) || 0)
                            }
                            className="w-20 h-8 text-sm"
                            min="1"
                          />
                          <Input
                            type="number"
                            placeholder="Precio"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateOrderItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-28 h-8 text-sm"
                            min="0"
                            step="0.01"
                          />
                          <span className="text-sm font-medium w-24 text-right">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => removeProductFromOrder(index)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}

                      {/* Totals */}
                      <Separator />
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>{formatCurrency(poSubtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ITBIS (18%):</span>
                          <span>{formatCurrency(poTax)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-base">
                          <span>Total:</span>
                          <span>{formatCurrency(poTotal)}</span>
                        </div>
                        {currentDollarRate > 0 && (
                          <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                            <span>Total Bs:</span>
                            <span className="font-semibold">{formatBs(poTotalBs)}</span>
                          </div>
                        )}
                        {currentDollarRate > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Tasa: 1 USD = Bs. {currentDollarRate.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {poItems.length === 0 && !showProductSearch && (
                    <p className="text-center text-muted-foreground text-sm py-4">
                      Agregue productos a la orden de compra
                    </p>
                  )}
                </div>

                <Separator />

                {/* Notes */}
                <div className="grid gap-2">
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="Notas adicionales..."
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closePODialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createPOMutation.isPending || !poSupplierId || poItems.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {createPOMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Crear Orden
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== PURCHASE ORDER DETAIL DIALOG ==================== */}
      <Dialog open={poDetailOpen} onOpenChange={setPoDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>Orden de Compra - {selectedOrder.number}</DialogTitle>
                <DialogDescription>
                  Detalle de la orden de compra
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Order Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Número</p>
                    <p className="font-medium">{selectedOrder.number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium">{formatDate(selectedOrder.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Proveedor</p>
                    <p className="font-medium">{selectedOrder.supplier.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <Badge className={PO_STATUS_COLORS[selectedOrder.status] || 'bg-gray-100 text-gray-800'}>
                      {selectedOrder.status}
                    </Badge>
                  </div>
                </div>

                {selectedOrder.dollarRate > 0 && (
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                    Tasa del día: 1 USD = Bs. {selectedOrder.dollarRate.toFixed(2)}
                  </div>
                )}

                {selectedOrder.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Notas</p>
                    <p className="text-sm">{selectedOrder.notes}</p>
                  </div>
                )}

                <Separator />

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">Recibido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.product.name}
                            <span className="text-muted-foreground ml-1">({item.product.code})</span>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitPrice)}
                            {selectedOrder.dollarRate > 0 && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{formatBs(item.unitPrice * selectedOrder.dollarRate)}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.subtotal)}
                            {selectedOrder.dollarRate > 0 && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{formatBs(item.subtotal * selectedOrder.dollarRate)}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.received}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ITBIS:</span>
                    <span>{formatCurrency(selectedOrder.tax)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total:</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                  {selectedOrder.totalBs > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                      <span>Total Bs:</span>
                      <span className="font-semibold">{formatBs(selectedOrder.totalBs)}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {selectedOrder.status === 'PENDIENTE' && (
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => cancelPOMutation.mutate(selectedOrder.id)}
                      disabled={cancelPOMutation.isPending}
                    >
                      <XCircle className="size-4 mr-2" />
                      Anular Orden
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => receivePOMutation.mutate(selectedOrder.id)}
                      disabled={receivePOMutation.isPending}
                    >
                      {receivePOMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                      <CheckCircle className="size-4 mr-2" />
                      Recibir Orden
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
