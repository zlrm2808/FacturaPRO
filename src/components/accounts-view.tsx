'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatCurrency, formatBs, formatDate, getStatusColor } from '@/lib/format'
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
  DialogTrigger,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FileText,
  Search,
  Printer,
  Plus,
  DollarSign,
  User,
  Phone,
  Mail,
  CreditCard,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

interface AccountEntry {
  id: string
  type: string
  amount: number
  amountBs: number
  dollarRate: number
  description: string | null
  date: string
  createdAt: string
  clientId: string
  client: { id: string; name: string }
  invoiceId: string | null
  invoice: { id: string; number: string; status: string } | null
  userId: string
  user: { id: string; name: string }
}

export function AccountsView() {
  const { selectedClientId, setSelectedClientId, setCurrentPage } = useAppStore()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [clientSearch, setClientSearch] = useState('')
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDescription, setPaymentDescription] = useState('')
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>('')

  // Search clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-search', clientSearch],
    queryFn: () => api.get(`/clients?search=${encodeURIComponent(clientSearch)}`),
    enabled: clientSearch.length > 0,
  })

  // Get account statement for selected client
  const activeClientId = selectedClientId
  const { data: statement, isLoading: statementLoading } = useQuery({
    queryKey: ['accounts', activeClientId],
    queryFn: () => api.get(`/accounts/${activeClientId}`),
    enabled: !!activeClientId,
  })

  // Get current dollar rate for Bs equivalents
  const { data: dollarRateData } = useQuery({
    queryKey: ['dollar-rate-today'],
    queryFn: () => api.get('/dollar-rates?action=today'),
    refetchInterval: 300000, // refetch every 5 min
  })
  const currentDollarRate = dollarRateData?.officialRate ?? 0

  // Register payment mutation
  const paymentMutation = useMutation({
    mutationFn: (data: { clientId: string; type: string; amount: number; description: string; invoiceId?: string }) =>
      api.post('/accounts', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', activeClientId] })
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

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId)
    setClientSearch('')
  }

  const handleRegisterPayment = () => {
    if (!activeClientId || !paymentAmount) return
    paymentMutation.mutate({
      clientId: activeClientId,
      type: 'ABONO',
      amount: parseFloat(paymentAmount),
      description: paymentDescription || 'Abono a cuenta',
      invoiceId: paymentInvoiceId || undefined,
    })
  }

  const handleGeneratePDF = () => {
    window.print()
  }

  // Client not selected - show search
  if (!activeClientId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Estados de Cuenta</h1>
            <p className="text-muted-foreground">Seleccione un cliente para ver su estado de cuenta</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nombre, teléfono, email o RNC..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {clientSearch.length > 0 && clients.length > 0 && (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {clients.map((client: Record<string, unknown>) => (
                      <button
                        key={client.id as string}
                        onClick={() => handleSelectClient(client.id as string)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{client.name as string}</p>
                            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                              {client.phone && <span>{client.phone as string}</span>}
                              {client.email && <span>{client.email as string}</span>}
                            </div>
                          </div>
                          {(client.balance as number) > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {formatCurrency(client.balance as number)}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {clientSearch.length > 0 && clients.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No se encontraron clientes</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Client selected - show account statement
  if (statementLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    )
  }

  const client = statement?.client
  const entries = statement?.entries || []
  const summary = statement?.summary
  const pendingInvoices = statement?.pendingInvoices || []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Estados de Cuenta</h1>
          <p className="text-muted-foreground">Estado de cuenta del cliente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSelectedClientId(null)}>
            <Search className="w-4 h-4 mr-2" />
            Cambiar Cliente
          </Button>
          <Button variant="outline" onClick={handleGeneratePDF}>
            <Printer className="w-4 h-4 mr-2" />
            Generar PDF
          </Button>
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Registrar Pago
              </Button>
            </DialogTrigger>
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
                {pendingInvoices.length > 0 && (
                  <div className="space-y-2">
                    <Label>Aplicar a factura (opcional)</Label>
                    <Select value={paymentInvoiceId} onValueChange={setPaymentInvoiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar factura..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin factura específica</SelectItem>
                        {pendingInvoices.map((inv: Record<string, unknown>) => (
                          <SelectItem key={inv.id as string} value={inv.id as string}>
                            {inv.number as string} - {formatCurrency(inv.total as number)}
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
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {paymentMutation.isPending ? 'Registrando...' : 'Registrar Pago'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Client Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">{client?.name}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {client?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{client.email}</span>
                  </div>
                )}
                {client?.rncCedula && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span>RNC/Cédula: {client.rncCedula}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Balance Actual</p>
              <p className={`text-3xl font-bold ${(client?.balance ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatCurrency(client?.balance ?? 0)}
              </p>
              {currentDollarRate > 0 && (client?.balance ?? 0) !== 0 && (
                <p className={`text-lg font-semibold ${(client?.balance ?? 0) > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {formatBs((client?.balance ?? 0) * currentDollarRate)}
                </p>
              )}
              {currentDollarRate > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tasa: Bs. {currentDollarRate.toFixed(2)} / USD
                </p>
              )}
            </div>
          </div>

          {summary && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-xs text-muted-foreground mb-1">Total Créditos</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(summary.totalCreditos)}</p>
                  {currentDollarRate > 0 && (
                    <p className="text-xs text-red-500">{formatBs(summary.totalCreditos * currentDollarRate)}</p>
                  )}
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-xs text-muted-foreground mb-1">Total Abonos</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalAbonos)}</p>
                  {currentDollarRate > 0 && (
                    <p className="text-xs text-emerald-500">{formatBs(summary.totalAbonos * currentDollarRate)}</p>
                  )}
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <p className="text-xs text-muted-foreground mb-1">Total Débitos</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalDebitos)}</p>
                  {currentDollarRate > 0 && (
                    <p className="text-xs text-emerald-500">{formatBs(summary.totalDebitos * currentDollarRate)}</p>
                  )}
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-xs text-muted-foreground mb-1">Fact. Pendientes</p>
                  <p className="text-lg font-bold text-amber-600">{summary.pendingInvoicesCount}</p>
                  {currentDollarRate > 0 && summary.pendingInvoicesTotal > 0 && (
                    <p className="text-xs text-amber-500">{formatBs(summary.pendingInvoicesTotal * currentDollarRate)}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Account Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Movimientos de Cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead className="text-right">Monto (USD)</TableHead>
                  <TableHead className="text-right">Monto (Bs)</TableHead>
                  <TableHead className="text-right">Tasa</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No hay movimientos registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry: AccountEntry) => {
                    const isCredit = entry.type === 'CREDITO'
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{formatDate(entry.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={isCredit
                              ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                              : 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
                            }
                          >
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{entry.description || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {entry.invoice?.number
                            ? (
                              <button
                                className="text-emerald-600 hover:underline"
                                onClick={() => {
                                  setCurrentPage('pos')
                                }}
                              >
                                {entry.invoice.number}
                              </button>
                            )
                            : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                          {isCredit ? '+' : '-'}{formatCurrency(entry.amount)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${isCredit ? 'text-red-600' : 'text-emerald-600'}`}>
                          {entry.amountBs > 0
                            ? `${isCredit ? '+' : '-'}${formatBs(entry.amountBs)}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {entry.dollarRate > 0 ? `Bs. ${entry.dollarRate.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">{entry.user?.name || '-'}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pending Invoices */}
      {pendingInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Facturas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total (USD)</TableHead>
                    <TableHead className="text-right">Total (Bs)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvoices.map((inv: Record<string, unknown>) => (
                    <TableRow key={inv.id as string}>
                      <TableCell className="font-medium">{inv.number as string}</TableCell>
                      <TableCell className="text-sm">{formatDate(inv.date as string)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(inv.status as string)}>
                          {inv.status as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(inv.total as number)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {currentDollarRate > 0
                          ? formatBs((inv.total as number) * currentDollarRate)
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Quick Client Change (from app store selectedClientId) */}
      {activeClientId && !statement && !statementLoading && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Seleccione un cliente para ver su estado de cuenta</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
