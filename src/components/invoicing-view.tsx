'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatBs, formatDateTime, formatDate, getStatusColor, getPaymentMethodLabel } from '@/lib/format'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  Trash2,
  Banknote,
  ArrowLeftRight,
  CreditCard,
  FileText,
  Package,
  User,
  CheckCircle2,
  X,
  Loader2,
  Receipt,
  ChevronDown,
  Printer,
  Eye,
  List,
  PenLine,
  ArrowLeft,
} from 'lucide-react'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxTrigger,
} from './ui/combobox'

interface InvoiceLineItem {
  productId: string
  name: string
  code: string
  quantity: number
  unitPrice: number
  discount: number
  subtotal: number
  unitOfMeasure: string
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
  address: string | null
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
  notes: string | null
  createdAt: string
  client: { id: string; name: string; rncCedula?: string | null; address?: string | null } | null
  user: { id: string; name: string }
  items: InvoiceItem[]
}

interface InvoiceItem {
  id: string
  quantity: number
  unitPrice: number
  subtotal: number
  discount: number
  product: { id: string; name: string; code: string; unitOfMeasure?: string }
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

const UNIT_ABBREV: Record<string, string> = {
  UNIDAD: 'Und',
  KILO: 'Kg',
  LITRO: 'Lt',
  CARTON: 'Crt',
  BOLSA: 'Bls',
  CAJA: 'Cja',
  GALON: 'Gal',
  METRO: 'Mtr',
  LIBRA: 'Lb',
}

type ViewMode = 'list' | 'create' | 'detail'

export function InvoicingView() {
  const queryClient = useQueryClient()

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Invoice form state
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [selectedClientName, setSelectedClientName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO')
  const [creditDays, setCreditDays] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [taxEnabled, setTaxEnabled] = useState(true)
  const [notes, setNotes] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)

  // Invoice list state
  const [listStatus, setListStatus] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [listPage, setListPage] = useState(1)

  // Invoice detail
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null)
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const selectedInvoiceId = useAppStore((state) => state.selectedInvoiceId)
  const setSelectedInvoiceId = useAppStore((state) => state.setSelectedInvoiceId)

  // Fetch dollar rate
  const { data: dollarRateData } = useQuery({
    queryKey: ['dollar-rate-today'],
    queryFn: () => api.get('/dollar-rates?action=effective'),
    refetchInterval: 300000,
  })
  const dollarRate = dollarRateData?.officialRate || 0

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['products', productSearch],
    queryFn: () => {
      const params = new URLSearchParams()
      if (productSearch) params.set('search', productSearch)
      // Only fetch available products for invoicing
      params.set('available', 'true')
      return api.get(`/products?${params.toString()}`)
    },
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

  // Fetch invoices for list
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', listStatus, listPage],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('limit', '15')
      params.set('page', String(listPage))
      if (listStatus) params.set('status', listStatus)
      return api.get(`/invoices?${params.toString()}`)
    },
  })

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => api.post('/invoices', data),
    onSuccess: (data) => {
      toast.success(`Factura ${data.number} creada exitosamente`, {
        description: `Total: ${formatCurrency(data.total)} / ${formatBs(data.totalBs)}`,
      })
      resetForm()
      setViewMode('list')
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error: Error) => {
      toast.error('Error al crear factura', {
        description: error.message || 'Intente de nuevo',
      })
    },
  })

  // Fetch company config to determine default tax rate
  const { data: companyData } = useQuery({ queryKey: ['company'], queryFn: () => api.get('/company') })

  useEffect(() => {
    if (companyData) {
      setTaxEnabled((companyData.taxRate ?? 16) !== 0)
    }
  }, [companyData])

  // Calculations
  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.subtotal, 0), [lineItems])
  const companyTaxPercent = companyData?.taxRate ?? 16
  const companyTaxRate = companyTaxPercent / 100
  const tax = useMemo(() => taxEnabled ? Math.max(0, subtotal - discount) * companyTaxRate : 0, [subtotal, discount, taxEnabled, companyTaxRate])
  const total = useMemo(() => {
    const taxable = Math.max(0, subtotal - discount)
    return taxable > 0 ? taxable + tax : 0
  }, [subtotal, discount, tax])
  const totalBs = useMemo(() => total * dollarRate, [total, dollarRate])

  // Add product to line items
  const addProduct = useCallback((product: Product) => {
    if (product.quantity <= 0) {
      toast.error('Producto sin stock disponible')
      return
    }

    const clientPrice = clientPrices.find((cp: any) => cp.productId === product.id)
    const effectivePrice = clientPrice ? clientPrice.customPrice : product.salePrice

    setLineItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        const newQty = existing.quantity + 1
        if (newQty > product.quantity) {
          toast.error('Stock insuficiente')
          return prev
        }
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
          unitOfMeasure: product.unitOfMeasure,
        },
      ]
    })
    setProductSearchOpen(false)
    setProductSearch('')
  }, [clientPrices])

  // Update line item
  const updateLineItem = useCallback((productId: string, field: string, value: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item
        const updated = { ...item, [field]: value }
        updated.subtotal = updated.quantity * updated.unitPrice - updated.discount
        return updated
      })
    )
  }, [])

  // Remove line item
  const removeLineItem = useCallback((productId: string) => {
    setLineItems((prev) => prev.filter((item) => item.productId !== productId))
  }, [])

  // Reset form
  const resetForm = () => {
    setLineItems([])
    setSelectedClientId('')
    setSelectedClientName('')
    setPaymentMethod('EFECTIVO')
    setCreditDays(0)
    setDiscount(0)
    setTaxEnabled(true)
    setNotes('')
    setProductSearch('')
  }

  // Process invoice
  const processInvoice = () => {
    if (lineItems.length === 0) {
      toast.error('Agregue al menos un producto')
      return
    }

    if (paymentMethod === 'CREDITO' && !selectedClientId) {
      toast.error('Seleccione un cliente para venta a crédito')
      return
    }

    const invoiceData = {
      clientId: selectedClientId || null,
      paymentMethod,
      discount,
      notes,
      creditDays: paymentMethod === 'CREDITO' ? creditDays : 0,
      taxEnabled,
      items: lineItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
    }

    createInvoiceMutation.mutate(invoiceData)
  }

  // View invoice detail
  const viewInvoice = async (invoiceId: string) => {
    try {
      const data = await api.get(`/invoices/${invoiceId}`)
      setSelectedInvoice(data)
      setInvoiceDialogOpen(true)
    } catch {
      toast.error('Error al cargar detalle de factura')
    }
  }

  useEffect(() => {
    if (!selectedInvoiceId) return
    viewInvoice(selectedInvoiceId)
    setSelectedInvoiceId(null)
  }, [selectedInvoiceId, setSelectedInvoiceId])

  // Update invoice status
  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      await api.put(`/invoices/${invoiceId}`, { status })
      toast.success(`Factura actualizada a ${status}`)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setInvoiceDialogOpen(false)
    } catch {
      toast.error('Error al actualizar factura')
    }
  }

  // Generate invoice PDF
  const generateInvoicePDF = async (invoice: InvoiceDetail) => {
    try {
      const { generateInvoiceDocumentPDF } = await import('@/lib/invoice-pdf')
      const companyData = await api.get('/company')
      const doc = generateInvoiceDocumentPDF(
        companyData || { name: 'FacturaPro' },
        {
          invoice: {
            number: invoice.number,
            date: invoice.date,
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            discount: invoice.discount,
            total: invoice.total,
            totalBs: invoice.totalBs,
            dollarRate: invoice.dollarRate,
            status: invoice.status,
            paymentMethod: invoice.paymentMethod,
            notes: invoice.notes,
          },
          client: invoice.client ? {
            name: invoice.client.name,
            rncCedula: (invoice.client as any).rncCedula || null,
            address: (invoice.client as any).address || null,
            phone: (invoice.client as any).phone || null,
          } : null,
          items: invoice.items.map((item) => ({
            name: item.product.name,
            code: item.product.code,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            subtotal: item.subtotal,
            unitOfMeasure: (item.product as any).unitOfMeasure || 'UNIDAD',
          })),
          user: invoice.user?.name || 'Sistema',
          dollarRate,
        }
      )
      doc.save(`Factura-${invoice.number}.pdf`)
      toast.success('PDF generado exitosamente')
    } catch (err) {
      console.error('Error generating PDF:', err)
      toast.error('Error al generar PDF')
    }
  }

  // Filtered products (active only, not already in line items)
  const activeProducts = useMemo(
    () => products.filter((p) => p.status === 'ACTIVO'),
    [products]
  )

  const invoices = invoicesData?.data || []
  const pagination = invoicesData?.pagination

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Facturación</h1>
          <p className="text-muted-foreground text-sm">Sistema de facturación tradicional</p>
        </div>
        {viewMode === 'list' && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            onClick={() => {
              resetForm()
              setViewMode('create')
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva Factura
          </Button>
        )}
        {viewMode !== 'list' && (
          <Button variant="outline" className="gap-2" onClick={() => setViewMode('list')}>
            <ArrowLeft className="h-4 w-4" />
            Volver a Lista
          </Button>
        )}
      </div>

      {viewMode === 'list' ? (
        /* ========== INVOICE LIST VIEW ========== */
        <InvoiceList
          invoices={invoices}
          isLoading={invoicesLoading}
          pagination={pagination}
          listPage={listPage}
          setListPage={setListPage}
          listStatus={listStatus}
          setListStatus={setListStatus}
          onViewInvoice={viewInvoice}
          dollarRate={dollarRate}
        />
      ) : viewMode === 'create' ? (
        /* ========== INVOICE CREATE VIEW ========== */
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Invoice Header + Line Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Invoice Header */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Datos de la Factura
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Client Selection */}
                  <div className="sm:col-span-2 -mt-6">
                    <Label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</Label>
                    <Combobox
                      open={clientPopoverOpen}
                      onOpenChange={setClientPopoverOpen}
                      value={selectedClientId}
                      onValueChange={(value) => {
                        // Buscamos el cliente seleccionado para actualizar también el nombre
                        const client = clients.find((c) => c.id === value);
                        if (client) {
                          setSelectedClientId(client.id);
                          setSelectedClientName(client.name);
                        } else {
                          // Por si se selecciona la opción "Sin cliente"
                          setSelectedClientId('');
                          setSelectedClientName('');
                        }
                      }}
                    >
                      {/* El disparador ahora usa los estilos de tu botón anterior */}
                      <ComboboxTrigger className="flex w-full items-center justify-between rounded-md border border-input bg-background h-10 px-3 text-sm font-normal shadow-xs hover:bg-accent hover:text-accent-foreground focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50">
                        {selectedClientId ? (
                          <span className="truncate">{selectedClientName}</span>
                        ) : (
                          <span className="text-muted-foreground">Seleccionar cliente...</span>
                        )}
                      </ComboboxTrigger>

                      <ComboboxContent align="start">
                        {/* Input de búsqueda interno del Combobox */}
                        <ComboboxInput
                          placeholder="Buscar cliente..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="m-1 h-8 text-sm"
                          showTrigger={false} // Ocultamos la flecha interna ya que el trigger principal la tiene
                        />

                        <ComboboxList>
                          {/* Opción por defecto: Sin Cliente */}
                          <ComboboxItem
                            value=""
                            onClick={() => {
                              setSelectedClientId('');
                              setSelectedClientName('');
                              setClientSearch('');
                            }}
                            className="text-muted-foreground"
                          >
                            <X className="h-3 w-3 mr-2 shrink-0" />
                            Sin cliente (Consumidor)
                          </ComboboxItem>

                          {/* Estado de Carga */}
                          {clientsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            /* Mapeo de Clientes */
                            clients.map((client) => (
                              <ComboboxItem
                                key={client.id}
                                value={client.id}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center min-w-0 flex-1">
                                  <User className="h-3 w-3 mr-2 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{client.name}</span>
                                  {client.rncCedula && (
                                    <span className="ml-2 text-xs text-muted-foreground truncate">
                                      ({client.rncCedula})
                                    </span>
                                  )}
                                </div>

                                {/* Badge de Balance */}
                                {client.balance > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="ml-2 text-[10px] px-1 border-amber-300 text-amber-700 whitespace-nowrap"
                                  >
                                    {formatCurrency(client.balance)}
                                  </Badge>
                                )}
                              </ComboboxItem>
                            ))
                          )}

                          {/* Mensaje si la lista está vacía tras filtrar */}
                          <ComboboxEmpty>No se encontraron clientes</ComboboxEmpty>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                  {/* Payment Method */}
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Método de Pago</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {PAYMENT_METHODS.map((method) => (
                        <Button
                          key={method.value}
                          variant="outline"
                          size="sm"
                          className={`h-9 text-xs gap-1.5 justify-center ${paymentMethod === method.value ? method.color : ''
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
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">Días de Crédito</Label>
                      <Input
                        type="number"
                        min={1}
                        value={creditDays || ''}
                        onChange={(e) => setCreditDays(Math.max(1, parseInt(e.target.value) || 0))}
                        className="h-10 text-sm"
                        placeholder="Ej. 15, 30"
                        required
                      />
                    </div>
                  )}

                  {/* Tax & Discount */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="tax-toggle"
                        checked={taxEnabled}
                        onCheckedChange={setTaxEnabled}
                        className="scale-90 origin-left"
                      />
                      <Label htmlFor="tax-toggle" className="text-sm cursor-pointer">IVA ({companyTaxPercent}%)</Label>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Descuento Global ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={subtotal}
                        value={discount || ''}
                        onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-9 text-sm mt-1"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Notas / Observaciones</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 text-sm min-h-[60px]"
                      placeholder="Notas adicionales..."
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Productos / Líneas
                    </CardTitle>
                    {/* Add Product Popover */}
                    <Combobox open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                      {/* El disparador ahora actúa como el botón de Shadcn de forma nativa, evitando duplicar etiquetas <button> */}
                      <ComboboxTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-1.5 text-xs focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50">
                        <Plus className="h-3.5 w-3.5 shrink-0" />
                        Agregar Producto
                      </ComboboxTrigger>

                      {/* Contenedor del desplegable */}
                      <ComboboxContent align="end" className="w-80">
                        {/* Input de búsqueda interno del Combobox */}
                        <ComboboxInput
                          placeholder="Buscar por nombre o código..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="m-1 h-8 text-sm"
                          autoFocus
                          showTrigger={false} // Ocultamos la flecha interna para un look limpio tipo popover
                        />

                        <ComboboxList>
                          {/* Estado de Carga */}
                          {productsLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : (
                            /* Mapeo de Productos Activos */
                            activeProducts.map((product) => {
                              const clientPrice = selectedClientId
                                ? clientPrices.find((cp: any) => cp.productId === product.id)
                                : null;
                              const effectivePrice = clientPrice ? clientPrice.customPrice : product.salePrice;
                              const inList = lineItems.find((l) => l.productId === product.id);

                              return (
                                <ComboboxItem
                                  key={product.id}
                                  value={product.id}
                                  onClick={() => addProduct(product)}
                                  className={`flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground ${inList ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                                    }`}
                                >
                                  {/* Información del Producto */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="truncate font-medium">{product.name}</span>
                                      {clientPrice && (
                                        <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1 py-0 border border-amber-300">
                                          ★
                                        </Badge>
                                      )}
                                      {inList && (
                                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1 py-0">
                                          ✓
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground block truncate">
                                      {product.code} · Stock: {product.quantity} {UNIT_ABBREV[product.unitOfMeasure] || 'Und'}
                                    </span>
                                  </div>

                                  {/* Precio */}
                                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 ml-2 whitespace-nowrap">
                                    {formatCurrency(effectivePrice)}
                                  </span>
                                </ComboboxItem>
                              );
                            })
                          )}

                          {/* Manejo automático de lista vacía por CSS de Base UI */}
                          <ComboboxEmpty>No se encontraron productos</ComboboxEmpty>
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                </CardHeader>
                <CardContent>
                  {lineItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Package className="h-10 w-10 mb-2 opacity-40" />
                      <p className="text-sm">Sin productos agregados</p>
                      <p className="text-xs">Use el botón "Agregar Producto" para comenzar</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px] text-xs">#</TableHead>
                            <TableHead className="text-xs">Código</TableHead>
                            <TableHead className="text-xs">Producto</TableHead>
                            <TableHead className="text-xs text-center w-[90px]">Cantidad</TableHead>
                            <TableHead className="text-xs text-right w-[110px]">P. Unitario</TableHead>
                            <TableHead className="text-xs text-right w-[100px]">Descuento</TableHead>
                            <TableHead className="text-xs text-right w-[110px]">Subtotal</TableHead>
                            <TableHead className="w-[40px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lineItems.map((item, idx) => (
                            <TableRow key={item.productId}>
                              <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell className="text-xs font-mono">{item.code}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm font-medium">{item.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{UNIT_ABBREV[item.unitOfMeasure] || 'Und'}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0.01}
                                  step={item.unitOfMeasure === 'UNIDAD' ? '1' : '0.01'}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    if (val > 0) updateLineItem(item.productId, 'quantity', val)
                                  }}
                                  className="h-8 text-sm text-center w-[80px]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    updateLineItem(item.productId, 'unitPrice', val)
                                  }}
                                  className="h-8 text-sm text-right w-[100px]"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.discount || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    updateLineItem(item.productId, 'discount', val)
                                  }}
                                  className="h-8 text-sm text-right w-[90px]"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <p className="text-sm font-semibold">{formatCurrency(item.subtotal)}</p>
                                {dollarRate > 0 && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                    {formatBs(item.subtotal * dollarRate)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  onClick={() => removeLineItem(item.productId)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right: Invoice Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Resumen de Factura
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Client info */}
                  {selectedClientId && (
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className="text-sm font-medium">{selectedClientName}</p>
                      {paymentMethod === 'CREDITO' && (
                        <Badge className="mt-1 bg-amber-100 text-amber-800 text-[10px] border-amber-300">Venta a Crédito</Badge>
                      )}
                    </div>
                  )}

                  {/* Items count */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Artículos</span>
                    <Badge variant="secondary">{lineItems.length}</Badge>
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <div className="text-right">
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                        {dollarRate > 0 && subtotal > 0 && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{formatBs(subtotal * dollarRate)}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">IVA (16%)</span>
                      <div className="text-right">
                        <span className="font-medium">{taxEnabled ? formatCurrency(tax) : '—'}</span>
                        {taxEnabled && dollarRate > 0 && tax > 0 && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{formatBs(tax * dollarRate)}</p>
                        )}
                      </div>
                    </div>

                    {discount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Descuento</span>
                        <span className="font-medium text-red-600">-{formatCurrency(discount)}</span>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold">Total</span>
                      <div className="text-right">
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(total)}</p>
                        {dollarRate > 0 && total > 0 && (
                          <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-300">{formatBs(totalBs)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 text-sm gap-2"
                      onClick={processInvoice}
                      disabled={lineItems.length === 0 || createInvoiceMutation.isPending}
                    >
                      {createInvoiceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Emitir Factura
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-9 gap-2"
                      onClick={resetForm}
                      disabled={lineItems.length === 0}
                    >
                      <X className="h-3.5 w-3.5" />
                      Limpiar Todo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null
      }

      {/* Invoice Detail Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                  {(selectedInvoice.client as any)?.rncCedula && (
                    <p className="text-xs text-muted-foreground">RNC: {(selectedInvoice.client as any).rncCedula}</p>
                  )}
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

              {selectedInvoice.notes && (
                <div className="p-2 rounded bg-muted/50 text-sm">
                  <p className="text-xs text-muted-foreground">Notas:</p>
                  <p>{selectedInvoice.notes}</p>
                </div>
              )}

              <Separator />

              {/* Items Table */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Detalle de Productos</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Producto</TableHead>
                        <TableHead className="text-xs text-center">Cant.</TableHead>
                        <TableHead className="text-xs text-right">P. Unit.</TableHead>
                        <TableHead className="text-xs text-right">Desc.</TableHead>
                        <TableHead className="text-xs text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="text-sm font-medium">{item.product.name}</p>
                            <p className="text-[10px] text-muted-foreground">{item.product.code}</p>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {item.quantity} {(item.product as any).unitOfMeasure ? UNIT_ABBREV[(item.product as any).unitOfMeasure] || '' : ''}
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right text-sm">
                            {item.discount > 0 ? formatCurrency(item.discount) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="text-sm font-semibold">{formatCurrency(item.subtotal)}</p>
                            {selectedInvoice.dollarRate > 0 && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                {formatBs(item.subtotal * selectedInvoice.dollarRate)}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                    <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedInvoice.total)}</span>
                    {selectedInvoice.totalBs > 0 && (
                      <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-300">
                        {formatBs(selectedInvoice.totalBs)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => generateInvoicePDF(selectedInvoice)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir PDF
                </Button>
                {selectedInvoice.status === 'PENDIENTE' && (
                  <>
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => updateInvoiceStatus(selectedInvoice.id, 'PAGADA')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Marcar Pagada
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => updateInvoiceStatus(selectedInvoice.id, 'ANULADA')}
                    >
                      <X className="h-3.5 w-3.5" />
                      Anular
                    </Button>
                  </>
                )}
                {selectedInvoice.status === 'VENCIDA' && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => updateInvoiceStatus(selectedInvoice.id, 'PAGADA')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Marcar Pagada
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div >
  )
}

/* ========== INVOICE LIST COMPONENT ========== */
function InvoiceList({
  invoices,
  isLoading,
  pagination,
  listPage,
  setListPage,
  listStatus,
  setListStatus,
  onViewInvoice,
  dollarRate,
}: {
  invoices: any[]
  isLoading: boolean
  pagination: any
  listPage: number
  setListPage: (p: number) => void
  listStatus: string
  setListStatus: (s: string) => void
  onViewInvoice: (id: string) => void
  dollarRate: number
}) {
  return (
    <Card className="flex-1 flex flex-col min-h-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <List className="h-4 w-4" />
            Historial de Facturas
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={listStatus} onValueChange={(v) => { setListStatus(v === 'all' ? '' : v); setListPage(1) }}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PAGADA">Pagadas</SelectItem>
                <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                <SelectItem value="VENCIDA">Vencidas</SelectItem>
                <SelectItem value="ANULADA">Anuladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
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
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Número</TableHead>
                    <TableHead className="text-xs">Fecha</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Cliente</TableHead>
                    <TableHead className="text-xs text-right">Total USD</TableHead>
                    <TableHead className="text-xs text-right hidden md:table-cell">Total Bs</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Estado</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Pago</TableHead>
                    <TableHead className="text-xs text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onViewInvoice(inv.id)}>
                      <TableCell className="font-mono text-xs font-medium">{inv.number}</TableCell>
                      <TableCell className="text-xs">{formatDate(inv.date)}</TableCell>
                      <TableCell className="text-xs hidden sm:table-cell">{inv.client?.name || 'Consumidor'}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">{formatCurrency(inv.total)}</TableCell>
                      <TableCell className="text-right text-xs hidden md:table-cell text-emerald-600 dark:text-emerald-400">
                        {inv.totalBs > 0 ? formatBs(inv.totalBs) : '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge className={`${getStatusColor(inv.status)} text-[10px]`}>{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">{getPaymentMethodLabel(inv.paymentMethod)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => { e.stopPropagation(); onViewInvoice(inv.id) }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Página {pagination.page} de {pagination.totalPages} · {pagination.total} facturas
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={listPage <= 1}
                    onClick={() => setListPage(listPage - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={listPage >= pagination.totalPages}
                    onClick={() => setListPage(listPage + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
