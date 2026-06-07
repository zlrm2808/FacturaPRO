'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatBs, formatDate } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  DialogClose,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertTriangle,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Phone,
  Mail,
  Loader2,
  Send,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
// daysOverdue is calculated server-side

interface OverdueInvoice {
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
  clientId: string
  daysOverdue: number
  client: {
    id: string
    name: string
    phone: string | null
    email: string | null
    balance: number
  }
}

interface ClientGroup {
  client: {
    id: string
    name: string
    phone: string | null
    email: string | null
    balance: number
  }
  invoices: OverdueInvoice[]
  totalBalance: number
  totalBalanceBs: number
}

interface OverdueData {
  clients: ClientGroup[]
  summary: {
    totalOverdueAmount: number
    totalInvoiceCount: number
    totalClientsWithDebt: number
  }
}

function formatPhoneForWhatsApp(phone: string | null): string | null {
  if (!phone) return null
  // Remove dashes, spaces, parentheses
  let cleaned = phone.replace(/[-\s()]/g, '')
  // If it already starts with +, just remove the +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
  }
  // Venezuelan numbers: if starts with 0, replace with 58
  if (/^0\d{9}$/.test(cleaned)) {
    cleaned = '58' + cleaned.substring(1)
  }
  // If it's a 10-digit number starting with 412, 414, 416, 424, 426 (Venezuelan mobile), prepend 58
  if (/^(412|414|416|424|426)\d{7}$/.test(cleaned)) {
    cleaned = '58' + cleaned
  }
  return cleaned
}

function buildWhatsAppMessage(clientName: string, invoices: OverdueInvoice[], totalBalance: number, totalBalanceBs: number): string {
  const invoiceLines = invoices
    .map((inv) => {
      const bsStr = inv.totalBs ? ` / ${formatBs(inv.totalBs)}` : ''
      return `📋 Factura ${inv.number} - Fecha: ${formatDate(inv.date)} - Monto: ${formatCurrency(inv.total)}${bsStr}`
    })
    .join('\n')

  const totalBsStr = totalBalanceBs ? ` / ${formatBs(totalBalanceBs)}` : ''
  return `Hola ${clientName}, le contactamos de FacturaPro para recordarle que tiene facturas pendientes de pago:\n\n${invoiceLines}\n\n💰 Total pendiente: ${formatCurrency(totalBalance)}${totalBsStr}\n\nPor favor comuníquese con nosotros para regularizar su cuenta. ¡Gracias!`
}

export function OverdueView() {
  const queryClient = useQueryClient()
  const { setSelectedClientId, setCurrentPage } = useAppStore()
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentClientId, setPaymentClientId] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>('')

  // Fetch overdue invoices
  const { data, isLoading } = useQuery<OverdueData>({
    queryKey: ['overdue-invoices'],
    queryFn: () => api.get('/invoices/overdue'),
  })

  // Mark as VENCIDA mutation
  const markAsVencidaMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      api.put(`/invoices/${invoiceId}`, { status: 'VENCIDA' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] })
      toast.success('Factura marcada como vencida')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al marcar factura como vencida')
    },
  })

  // Register payment mutation
  const paymentMutation = useMutation({
    mutationFn: (data: { clientId: string; type: string; amount: number; description: string; invoiceId?: string }) =>
      api.post('/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overdue-invoices'] })
      setPaymentDialogOpen(false)
      setPaymentAmount('')
      setPaymentDescription('')
      setPaymentInvoiceId('')
      toast.success('Pago registrado correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al registrar pago')
    },
  })

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const handleWhatsApp = (clientGroup: ClientGroup) => {
    const phone = formatPhoneForWhatsApp(clientGroup.client.phone)
    if (!phone) {
      toast.error('El cliente no tiene teléfono registrado')
      return
    }
    const message = buildWhatsAppMessage(clientGroup.client.name, clientGroup.invoices, clientGroup.totalBalance, clientGroup.totalBalanceBs)
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleMassReminder = () => {
    if (!data?.clients.length) return
    let opened = 0
    for (const clientGroup of data.clients) {
      const phone = formatPhoneForWhatsApp(clientGroup.client.phone)
      if (phone) {
        const message = buildWhatsAppMessage(clientGroup.client.name, clientGroup.invoices, clientGroup.totalBalance, clientGroup.totalBalanceBs)
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
        opened++
      }
    }
    if (opened > 0) {
      toast.success(`Se abrieron ${opened} ventana(s) de WhatsApp`)
    } else {
      toast.warning('Ningún cliente tiene teléfono registrado')
    }
  }

  const openPaymentDialog = (clientId: string, invoices: OverdueInvoice[]) => {
    setPaymentClientId(clientId)
    setPaymentAmount('')
    setPaymentDescription('')
    setPaymentInvoiceId('')
    setPaymentDialogOpen(true)
  }

  const handleRegisterPayment = () => {
    if (!paymentClientId || !paymentAmount) return
    paymentMutation.mutate({
      clientId: paymentClientId,
      type: 'ABONO',
      amount: parseFloat(paymentAmount),
      description: paymentDescription || 'Abono a cuenta',
      invoiceId: paymentInvoiceId && paymentInvoiceId !== 'none' ? paymentInvoiceId : undefined,
    })
  }

  const getStatusBadge = (status: string, daysOverdue: number) => {
    if (status === 'VENCIDA') {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">VENCIDA</Badge>
    }
    if (status === 'PENDIENTE' && daysOverdue > 30) {
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">PENDIENTE ({daysOverdue}d)</Badge>
    }
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">PENDIENTE</Badge>
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
          </div>
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const clients = data?.clients || []
  const summary = data?.summary || { totalOverdueAmount: 0, totalInvoiceCount: 0, totalClientsWithDebt: 0 }

  // Compute total overdue amount in Bs from all client groups
  const totalOverdueAmountBs = clients.reduce((sum, cg) => sum + (cg.totalBalanceBs || 0), 0)

  // Get current client invoices for payment dialog
  const currentClientGroup = clients.find((c) => c.client.id === paymentClientId)
  const currentClientInvoices = currentClientGroup?.invoices || []

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Facturas Vencidas</h1>
            <p className="text-sm text-muted-foreground">
              Gestión de facturas pendientes y vencidas
            </p>
          </div>
        </div>
        <Button
          onClick={handleMassReminder}
          disabled={clients.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
        >
          <Send className="size-4 mr-2" />
          Enviar Recordatorio Masivo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <DollarSign className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vencido</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(summary.totalOverdueAmount)}
                </p>
                {totalOverdueAmountBs > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatBs(totalOverdueAmountBs)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Facturas Vencidas</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {summary.totalInvoiceCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <User className="size-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes con Deuda</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {summary.totalClientsWithDebt}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Cards */}
      {clients.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertTriangle className="size-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              No hay facturas vencidas
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Todos los pagos están al día
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[calc(100vh-380px)]">
          <div className="space-y-4 pr-4">
            {clients.map((clientGroup) => {
              const isExpanded = expandedClients.has(clientGroup.client.id)
              return (
                <Card key={clientGroup.client.id} className="overflow-hidden">
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleClient(clientGroup.client.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="cursor-pointer">
                        <CardContent className="p-4 md:p-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <button
                                className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleClient(clientGroup.client.id)
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="size-5" />
                                ) : (
                                  <ChevronRight className="size-5" />
                                )}
                              </button>
                              <div className="space-y-1">
                                <h3 className="text-lg font-semibold">
                                  <button
                                    className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors text-left"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedClientId(clientGroup.client.id)
                                      setCurrentPage('accounts')
                                    }}
                                  >
                                    {clientGroup.client.name}
                                  </button>
                                </h3>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                  {clientGroup.client.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="size-3" />
                                      {clientGroup.client.phone}
                                    </span>
                                  )}
                                  {clientGroup.client.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="size-3" />
                                      {clientGroup.client.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 md:gap-4">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Total Pendiente</p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                  {formatCurrency(clientGroup.totalBalance)}
                                </p>
                                {clientGroup.totalBalanceBs > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {formatBs(clientGroup.totalBalanceBs)}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {clientGroup.invoices.length} factura{clientGroup.invoices.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleWhatsApp(clientGroup)
                                  }}
                                  disabled={!clientGroup.client.phone}
                                >
                                  <MessageCircle className="size-4 mr-1" />
                                  WhatsApp
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openPaymentDialog(clientGroup.client.id, clientGroup.invoices)
                                  }}
                                >
                                  <DollarSign className="size-4 mr-1" />
                                  Abonar
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div className="p-4 md:p-6">
                        <h4 className="text-sm font-medium text-muted-foreground mb-3">
                          Detalle de Facturas
                        </h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Número</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="text-right">Subtotal</TableHead>
                                <TableHead className="text-right">ITBIS</TableHead>
                                <TableHead className="text-right">Descuento</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Total Bs</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Días Vencida</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {clientGroup.invoices.map((invoice) => {
                                const days = invoice.daysOverdue || 0
                                return (
                                  <TableRow key={invoice.id}>
                                    <TableCell className="font-medium">{invoice.number}</TableCell>
                                    <TableCell className="text-sm">{formatDate(invoice.date)}</TableCell>
                                    <TableCell className="text-right text-sm">{formatCurrency(invoice.subtotal)}</TableCell>
                                    <TableCell className="text-right text-sm">{formatCurrency(invoice.tax)}</TableCell>
                                    <TableCell className="text-right text-sm">{formatCurrency(invoice.discount)}</TableCell>
                                    <TableCell className="text-right font-medium">{formatCurrency(invoice.total)}</TableCell>
                                    <TableCell className="text-right text-sm">
                                      {invoice.totalBs ? formatBs(invoice.totalBs) : '—'}
                                    </TableCell>
                                    <TableCell>{getStatusBadge(invoice.status, days)}</TableCell>
                                    <TableCell className="text-right">
                                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                        {days}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {invoice.status === 'PENDIENTE' && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 text-xs h-7"
                                          onClick={() => markAsVencidaMutation.mutate(invoice.id)}
                                          disabled={markAsVencidaMutation.isPending}
                                        >
                                          Marcar como Vencida
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* Register Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago (Abono)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                placeholder="Descripción del pago..."
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
              />
            </div>
            {currentClientInvoices.length > 0 && (
              <div className="space-y-2">
                <Label>Aplicar a factura (opcional)</Label>
                <Select value={paymentInvoiceId} onValueChange={setPaymentInvoiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar factura..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin factura específica</SelectItem>
                    {currentClientInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.number} - {formatCurrency(inv.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleRegisterPayment}
              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || paymentMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {paymentMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
