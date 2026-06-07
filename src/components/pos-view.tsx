'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatBs, formatDateTime, getStatusColor, getPaymentMethodLabel } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Banknote,
  ArrowLeftRight,
  CreditCard,
  FileText,
  History,
  Package,
  User,
  CheckCircle2,
  X,
  Loader2,
  Receipt,
  ChevronDown,
} from 'lucide-react'

interface CartItem {
  productId: string
  name: string
  code: string
  quantity: number
  unitPrice: number
  discount: number
  subtotal: number
}

interface Product {
  id: string
  code: string
  name: string
  description: string | null
  salePrice: number
  quantity: number
  minStock: number
  unitOfMeasure: string
  status: string
  categoryId: string | null
  category: { id: string; name: string } | null
}

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  rncCedula: string | null
  balance: number
}

interface Invoice {
  id: string
  number: string
  date: string
  subtotal: number
  tax: number
  discount: number
  total: number
  totalBs: number
  dollarRate: number
  status: string
  paymentMethod: string
  createdAt: string
  client: { id: string; name: string } | null
  user: { id: string; name: string }
  items: InvoiceItem[]
}

interface InvoiceItem {
  id: string
  quantity: number
  unitPrice: number
  subtotal: number
  discount: number
  product: { id: string; name: string; code: string }
}

interface InvoiceDetail extends Invoice {
  accountEntries: any[]
}

const PAYMENT_METHODS = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: Banknote, color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: ArrowLeftRight, color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700' },
  { value: 'TARJETA', label: 'Tarjeta', icon: CreditCard, color: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-700' },
  { value: 'CREDITO', label: 'Crédito', icon: FileText, color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700' },
]

export function PosView() {
  const queryClient = useQueryClient()

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedClientName, setSelectedClientName] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO')
  const [creditDays, setCreditDays] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [clientSearch, setClientSearch] = useState('')
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)
  const { posHistoryOpen, setPosHistoryOpen } = useAppStore()
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)

  // Fetch today's dollar rate
  const { data: dollarRateData } = useQuery({
    queryKey: ['dollar-rate-today'],
    queryFn: () => api.get('/dollar-rates?action=effective'),
    refetchInterval: 300000, // Refresh every 5 minutes
  })
  const dollarRate = dollarRateData?.officialRate || 0

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products', searchTerm, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      if (selectedCategory !== 'all') params.set('category', selectedCategory)
      return api.get(`/products?${params.toString()}`)
    },
  })

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  })

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ['clients', clientSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (clientSearch) params.set('search', clientSearch)
      return api.get(`/clients?${params.toString()}`)
    },
  })

  // Fetch client prices when a client is selected
  const { data: clientPrices = [] } = useQuery({
    queryKey: ['client-prices', selectedClientId],
    queryFn: () => api.get(`/client-prices?clientId=${selectedClientId}`),
    enabled: !!selectedClientId,
  })

  // Fetch invoices for history
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/invoices?limit=20'),
    enabled: posHistoryOpen,
  })

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => api.post('/invoices', data),
    onSuccess: (data) => {
      toast.success(`Factura ${data.number} creada exitosamente`, {
        description: `Total: ${formatCurrency(data.total)} / ${formatBs(data.totalBs)}`,
      })
      // Clear cart
      setCart([])
      setDiscount(0)
      setSelectedClientId(null)
      setSelectedClientName('')
      setPaymentMethod('EFECTIVO')
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error: Error) => {
      toast.error('Error al crear factura', {
        description: error.message || 'Intente de nuevo',
      })
    },
  })

  // Cart calculations
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart])
  const cartTax = useMemo(() => taxEnabled ? (cartSubtotal - discount) * 0.16 : 0, [cartSubtotal, discount, taxEnabled])
  const cartTotal = useMemo(() => {
    const taxable = cartSubtotal - discount
    return taxable > 0 ? taxable + cartTax : 0
  }, [cartSubtotal, discount, cartTax])
  const cartTotalBs = useMemo(() => cartTotal * dollarRate, [cartTotal, dollarRate])

  // Add to cart
  const addToCart = useCallback((product: Product) => {
    if (product.quantity <= 0 && !cart.find((c) => c.productId === product.id)) {
      toast.error('Producto sin stock disponible')
      return
    }

    // Check if there's a custom price for this client
    const clientPrice = clientPrices.find((cp: any) => cp.productId === product.id)
    const effectivePrice = clientPrice ? clientPrice.customPrice : product.salePrice

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast.error('Stock insuficiente')
          return prev
        }
        const newQty = existing.quantity + 1
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: newQty, subtotal: newQty * item.unitPrice - item.discount }
            : item
        )
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          code: product.code,
          quantity: 1,
          unitPrice: effectivePrice,
          discount: 0,
          subtotal: effectivePrice,
        },
      ]
    })
  }, [cart, clientPrices])

  // Update cart item quantity
  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return null as any
          return {
            ...item,
            quantity: newQty,
            subtotal: newQty * item.unitPrice - item.discount,
          }
        })
        .filter(Boolean)
    )
  }, [])

  // Remove from cart
  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }, [])

  // Process invoice
  const processInvoice = () => {
    if (cart.length === 0) {
      toast.error('El carrito está vacío')
      return
    }

    if (paymentMethod === 'CREDITO' && !selectedClientId) {
      toast.error('Seleccione un cliente para venta a crédito')
      return
    }

    const invoiceData = {
      clientId: selectedClientId,
      paymentMethod,
      discount,
      notes: '',
      creditDays: paymentMethod === 'CREDITO' ? creditDays : 0,
      items: cart.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
    }

    createInvoiceMutation.mutate(invoiceData)
  }

  // View invoice details
  const viewInvoice = async (invoiceId: string) => {
    try {
      const data = await api.get(`/invoices/${invoiceId}`)
      setSelectedInvoice(data)
      setInvoiceDialogOpen(true)
    } catch {
      toast.error('Error al cargar detalle de factura')
    }
  }

  // New sale
  const newSale = () => {
    setCart([])
    setDiscount(0)
    setSelectedClientId(null)
    setSelectedClientName('')
    setPaymentMethod('EFECTIVO')
    setCreditDays(0)
    setTaxEnabled(true)
    setSearchTerm('')
    setSelectedCategory('all')
  }

  // Filtered products (only active)
  const activeProducts = useMemo(
    () => products.filter((p) => p.status === 'ACTIVO'),
    [products]
  )

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight">Facturación (POS)</h1>
        <p className="text-muted-foreground text-sm">Punto de venta</p>
      </div>

      {posHistoryOpen ? (
        <InvoiceHistory
          invoicesData={invoicesData}
          isLoading={invoicesLoading}
          onViewInvoice={viewInvoice}
          onClose={() => setPosHistoryOpen(false)}
          dollarRate={dollarRate}
        />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Left Side - Product Search & Grid */}
          <div className="flex-1 lg:w-[60%] flex flex-col min-h-0">
            {/* Search Bar */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="whitespace-nowrap text-xs shrink-0"
              >
                Todos
              </Button>
              {categories.map((cat: any) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="whitespace-nowrap text-xs shrink-0"
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {productsLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-5 w-1/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : activeProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Package className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">No se encontraron productos</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {activeProducts.map((product) => {
                    const inCart = cart.find((c) => c.productId === product.id)
                    const isLowStock = product.quantity <= product.minStock
                    const clientPrice = selectedClientId ? clientPrices.find((cp: any) => cp.productId === product.id) : null
                    const effectivePrice = clientPrice ? clientPrice.customPrice : product.salePrice
                    return (
                      <Card
                        key={product.id}
                        className={`cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors ${
                          inCart ? 'border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-200 dark:ring-emerald-800' : ''
                        } ${
                          clientPrice ? 'border-amber-300 dark:border-amber-700' : ''
                        }`}
                        onClick={() => addToCart(product)}
                      >
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-sm font-medium leading-tight line-clamp-2">{product.name}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              {clientPrice && (
                                <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" title="Precio personalizado">
                                  ★
                                </Badge>
                              )}
                              {inCart && (
                                <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                                  {inCart.quantity}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">{product.code}</p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(effectivePrice)}
                              </p>
                              {clientPrice && (
                                <p className="text-[10px] text-muted-foreground line-through">
                                  {formatCurrency(product.salePrice)}
                                </p>
                              )}
                              {dollarRate > 0 && (
                                <p className="text-[10px] text-muted-foreground">
                                  {formatBs(effectivePrice * dollarRate)}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                product.quantity === 0
                                  ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                                  : isLowStock
                                  ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'
                                  : 'border-muted-foreground/30 text-muted-foreground'
                              }`}
                            >
                              {product.quantity === 0 ? 'Agotado' : `${product.quantity} ${product.unitOfMeasure ? product.unitOfMeasure.substring(0, 3).toLowerCase() : 'uds'}`}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Cart / Invoice */}
          <div className="lg:w-[40%] flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0">
              {/* Cart Header */}
              <CardHeader className="pb-2 px-3 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <ShoppingCart className="h-4 w-4" />
                    Carrito
                  </CardTitle>
                  {cart.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{cart.length}</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col min-h-0 px-3 pb-3 pt-0">
                {/* Client Selection */}
                <div className="mb-2">
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">Cliente</Label>
                  <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between text-sm font-normal h-9"
                      >
                        {selectedClientId ? (
                          <span className="truncate">{selectedClientName}</span>
                        ) : (
                          <span className="text-muted-foreground">Seleccionar cliente...</span>
                        )}
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                      <div className="p-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input
                            placeholder="Buscar cliente..."
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="pl-8 h-8 text-sm"
                          />
                        </div>
                      </div>
                      <ScrollArea className="max-h-52">
                        <div className="p-1">
                          <div
                            onClick={() => {
                              setSelectedClientId(null)
                              setSelectedClientName('')
                              setClientPopoverOpen(false)
                              setClientSearch('')
                            }}
                            className="flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                          >
                            <X className="h-3 w-3 mr-2" />
                            Sin cliente (Consumidor)
                          </div>
                          {clientsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : clients.length === 0 && clientSearch ? (
                            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                              No se encontró cliente
                            </div>
                          ) : (
                            clients.map((client) => (
                              <div
                                key={client.id}
                                onClick={() => {
                                  setSelectedClientId(client.id)
                                  setSelectedClientName(client.name)
                                  setClientPopoverOpen(false)
                                  setClientSearch('')
                                }}
                                className="flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                              >
                                <User className="h-3 w-3 mr-2 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="truncate">{client.name}</span>
                                  {client.balance > 0 && (
                                    <Badge variant="outline" className="ml-2 text-[10px] px-1 border-amber-300 text-amber-700">
                                      {formatCurrency(client.balance)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator className="mb-2" />

                {/* Cart Items */}
                <ScrollArea className="max-h-[30vh] min-h-0">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">Carrito vacío</p>
                      <p className="text-xs">Haga clic en un producto para agregarlo</p>
                    </div>
                  ) : (
                    <div className="space-y-2 pr-2">
                      {cart.map((item) => (
                        <div
                          key={item.productId}
                          className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border/50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(item.unitPrice)} c/u
                              {dollarRate > 0 && (
                                <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                                  ({formatBs(item.unitPrice * dollarRate)})
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => updateQuantity(item.productId, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => updateQuantity(item.productId, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right min-w-[70px]">
                            <p className="text-sm font-semibold">{formatCurrency(item.subtotal)}</p>
                            {dollarRate > 0 && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                {formatBs(item.subtotal * dollarRate)}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => removeFromCart(item.productId)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <Separator className="my-2" />

                {/* Summary */}
                <div className="space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <div className="text-right">
                      <span className="font-medium">{formatCurrency(cartSubtotal)}</span>
                      {dollarRate > 0 && cartSubtotal > 0 && (
                        <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">
                          {formatBs(cartSubtotal * dollarRate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tax Toggle */}
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="tax-toggle"
                        checked={taxEnabled}
                        onCheckedChange={setTaxEnabled}
                        className="scale-75 origin-left"
                      />
                      <Label htmlFor="tax-toggle" className="text-sm text-muted-foreground cursor-pointer">
                        IVA (16%)
                      </Label>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">
                        {taxEnabled ? formatCurrency(cartTax) : '—'}
                      </span>
                      {taxEnabled && dollarRate > 0 && cartTax > 0 && (
                        <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">
                          {formatBs(cartTax * dollarRate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <Label className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Descuento</Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={cartSubtotal}
                        value={discount || ''}
                        onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-24 h-7 text-sm text-right"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <span className="text-base sm:text-lg font-bold">Total</span>
                    <div className="text-right">
                      <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(cartTotal)}
                      </p>
                      {dollarRate > 0 && cartTotal > 0 && (
                        <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-300">
                          {formatBs(cartTotalBs)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="mt-2 shrink-0">
                  <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    Método de Pago
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PAYMENT_METHODS.map((method) => (
                      <Button
                        key={method.value}
                        variant="outline"
                        size="sm"
                        className={`h-9 text-xs gap-1.5 justify-center ${
                          paymentMethod === method.value
                            ? method.color
                            : ''
                        }`}
                        onClick={() => {
                          setPaymentMethod(method.value)
                          if (method.value !== 'CREDITO') {
                            setCreditDays(0)
                          }
                        }}
                      >
                        <method.icon className="h-3.5 w-3.5" />
                        {method.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'CREDITO' && (
                  <div className="mt-2 shrink-0">
                    <Label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                      Días de Crédito
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={creditDays || ''}
                      onChange={(e) => setCreditDays(Math.max(1, parseInt(e.target.value) || 0))}
                      className="h-9 text-sm"
                      placeholder="Ej. 15, 30"
                      required
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-2 space-y-1.5 shrink-0">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 text-sm gap-2"
                    onClick={processInvoice}
                    disabled={cart.length === 0 || createInvoiceMutation.isPending}
                  >
                    {createInvoiceMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Procesar Factura
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full h-9 gap-2"
                    onClick={newSale}
                    disabled={cart.length === 0}
                  >
                    <X className="h-3.5 w-3.5" />
                    Nueva Venta
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Invoice Detail Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Factura {selectedInvoice?.number}
            </DialogTitle>
            <DialogDescription>Detalle de factura</DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Fecha</p>
                  <p className="font-medium">{formatDateTime(selectedInvoice.date)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Estado</p>
                  <Badge className={getStatusColor(selectedInvoice.status)}>
                    {selectedInvoice.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cliente</p>
                  <p className="font-medium">{selectedInvoice.client?.name || 'Consumidor'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Método de Pago</p>
                  <p className="font-medium">{getPaymentMethodLabel(selectedInvoice.paymentMethod)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cajero</p>
                  <p className="font-medium">{selectedInvoice.user?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tasa del Día</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    {selectedInvoice.dollarRate > 0 ? `Bs. ${selectedInvoice.dollarRate.toFixed(2)}` : 'N/A'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Productos</p>
                <div className="space-y-1.5">
                  {selectedInvoice.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                          {item.discount > 0 && ` - Desc: ${formatCurrency(item.discount)}`}
                        </p>
                      </div>
                      <div className="text-right ml-2">
                        <span className="font-semibold">{formatCurrency(item.subtotal)}</span>
                        {selectedInvoice.dollarRate > 0 && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            {formatBs(item.subtotal * selectedInvoice.dollarRate)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span>{formatCurrency(selectedInvoice.tax)}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descuento</span>
                    <span className="text-red-600">-{formatCurrency(selectedInvoice.discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <div className="text-right">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(selectedInvoice.total)}
                    </span>
                    {selectedInvoice.totalBs > 0 && (
                      <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-300">
                        {formatBs(selectedInvoice.totalBs)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Invoice History Component
function InvoiceHistory({
  invoicesData,
  isLoading,
  onViewInvoice,
  onClose,
  dollarRate,
}: {
  invoicesData: any
  isLoading: boolean
  onViewInvoice: (id: string) => void
  onClose: () => void
  dollarRate: number
}) {
  const invoices = invoicesData?.data || []

  return (
    <Card className="flex-1 flex flex-col min-h-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial de Ventas
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Receipt className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">No hay facturas registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground">Número</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left py-2 font-medium text-muted-foreground hidden sm:table-cell">Cliente</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-right py-2 font-medium text-muted-foreground hidden md:table-cell">Bs.</th>
                  <th className="text-left py-2 font-medium text-muted-foreground hidden md:table-cell">Estado</th>
                  <th className="text-left py-2 font-medium text-muted-foreground hidden lg:table-cell">Pago</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-2.5 font-medium text-xs">{inv.number}</td>
                    <td className="py-2.5 text-xs">{formatDateTime(inv.date)}</td>
                    <td className="py-2.5 text-xs hidden sm:table-cell">
                      {inv.client?.name || 'Consumidor'}
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-right">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="py-2.5 text-xs font-semibold text-right hidden md:table-cell text-emerald-600 dark:text-emerald-400">
                      {inv.totalBs > 0 ? formatBs(inv.totalBs) : '-'}
                    </td>
                    <td className="py-2.5 hidden md:table-cell">
                      <Badge className={`text-[10px] ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-xs hidden lg:table-cell">
                      {getPaymentMethodLabel(inv.paymentMethod)}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => onViewInvoice(inv.id)}
                      >
                        <Receipt className="h-3 w-3" />
                        <span className="hidden sm:inline">Ver</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
