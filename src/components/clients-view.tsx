'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Search,
  Plus,
  Pencil,
  Eye,
  Trash2,
  Users,
  Loader2,
  Tags,
} from 'lucide-react'

// Types
interface Client {
  id: string
  name: string
  phone: string | null
  address: string | null
  email: string | null
  rncCedula: string | null
  balance: number
  createdAt: string
  updatedAt: string
  invoiceCount: number
  pendingBalance: number
}

interface ClientFormData {
  name: string
  phone: string
  address: string
  email: string
  rncCedula: string
}

const emptyForm: ClientFormData = {
  name: '',
  phone: '',
  address: '',
  email: '',
  rncCedula: '',
}

const ITEMS_PER_PAGE = 10

export function ClientsView() {
  const queryClient = useQueryClient()
  const { setCurrentPage: navigateToPage, setSelectedClientId } = useAppStore()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deleteClient, setDeleteClient] = useState<Client | null>(null)
  const [formData, setFormData] = useState<ClientFormData>(emptyForm)

  // Price list dialog state
  const [priceListDialogOpen, setPriceListDialogOpen] = useState(false)
  const [priceListClientId, setPriceListClientId] = useState<string | null>(null)
  const [priceListClientName, setPriceListClientName] = useState('')
  const [productSearchForPrice, setProductSearchForPrice] = useState('')
  const [newCustomPrice, setNewCustomPrice] = useState('')
  const [newCustomProductId, setNewCustomProductId] = useState<string | null>(null)

  // Debounce search
  const debounceTimer = useState<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value)
      if (debounceTimer[0]) clearTimeout(debounceTimer[0])
      const timer = setTimeout(() => {
        setDebouncedSearch(value)
        setPage(1)
      }, 400)
      debounceTimer[1](timer)
    },
    []
  )

  // Fetch clients
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', debouncedSearch],
    queryFn: () => {
      const params = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ''
      return api.get(`/clients${params}`)
    },
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) => api.post('/clients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Cliente creado exitosamente')
      closeDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear cliente')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientFormData }) =>
      api.put(`/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Cliente actualizado exitosamente')
      closeDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar cliente')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Cliente eliminado exitosamente')
      setDeleteClient(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar cliente')
    },
  })

  // Dialog handlers
  const openNewDialog = () => {
    setEditingClient(null)
    setFormData(emptyForm)
    setDialogOpen(true)
  }

  const openEditDialog = (client: Client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      phone: client.phone || '',
      address: client.address || '',
      email: client.email || '',
      rncCedula: client.rncCedula || '',
    })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingClient(null)
    setFormData(emptyForm)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleViewDetails = (client: Client) => {
    setSelectedClientId(client.id)
    navigateToPage('accounts')
  }

  // Pagination
  const totalPages = Math.ceil(clients.length / ITEMS_PER_PAGE)
  const paginatedClients = clients.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  const renderPaginationItems = () => {
    const items = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)

    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={i === page}
            onClick={() => setPage(i)}
            className="cursor-pointer"
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      )
    }
    return items
  }

  // Fetch client prices when dialog opens
  const { data: clientPrices = [], isLoading: clientPricesLoading } = useQuery({
    queryKey: ['client-prices', priceListClientId],
    queryFn: () => api.get(`/client-prices?clientId=${priceListClientId}`),
    enabled: !!priceListClientId && priceListDialogOpen,
  })

  // Fetch products for adding to price list
  const { data: priceListProducts = [] } = useQuery({
    queryKey: ['products', productSearchForPrice],
    queryFn: () => {
      const params = productSearchForPrice ? `?search=${encodeURIComponent(productSearchForPrice)}` : ''
      return api.get(`/products${params}`)
    },
    enabled: priceListDialogOpen && productSearchForPrice.length > 0,
  })

  // Add custom price mutation
  const addPriceMutation = useMutation({
    mutationFn: (data: { clientId: string; productId: string; customPrice: number }) =>
      api.post('/client-prices', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-prices', priceListClientId] })
      toast.success('Precio personalizado guardado')
      setNewCustomPrice('')
      setNewCustomProductId(null)
      setProductSearchForPrice('')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al guardar precio')
    },
  })

  // Delete custom price mutation
  const deletePriceMutation = useMutation({
    mutationFn: (id: string) => api.del(`/client-prices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-prices', priceListClientId] })
      toast.success('Precio personalizado eliminado')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar precio')
    },
  })

  const openPriceListDialog = (client: Client) => {
    setPriceListClientId(client.id)
    setPriceListClientName(client.name)
    setPriceListDialogOpen(true)
    setProductSearchForPrice('')
    setNewCustomPrice('')
    setNewCustomProductId(null)
  }

  const closePriceListDialog = () => {
    setPriceListDialogOpen(false)
    setPriceListClientId(null)
    setPriceListClientName('')
    setProductSearchForPrice('')
    setNewCustomPrice('')
    setNewCustomProductId(null)
  }

  const handleAddPrice = () => {
    if (!priceListClientId || !newCustomProductId || !newCustomPrice) {
      toast.error('Seleccione un producto e ingrese el precio')
      return
    }
    const price = parseFloat(newCustomPrice)
    if (isNaN(price) || price < 0) {
      toast.error('Ingrese un precio válido')
      return
    }
    addPriceMutation.mutate({
      clientId: priceListClientId,
      productId: newCustomProductId,
      customPrice: price,
    })
  }

  const isMutating = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Users className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Clientes</h1>
            <p className="text-sm text-muted-foreground">
              {clients.length} cliente{clients.length !== 1 ? 's' : ''} registrado{clients.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          onClick={openNewDialog}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="size-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono, email, RNC..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="size-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              No se encontraron clientes
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {debouncedSearch
                ? 'Intenta con otro término de búsqueda'
                : 'Agrega tu primer cliente haciendo clic en "Nuevo Cliente"'}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">RNC/Cédula</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="hidden xl:table-cell">Fecha Registro</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <button
                        className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors text-left"
                        onClick={() => handleViewDetails(client)}
                      >
                        {client.name}
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {client.phone || '-'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {client.email || '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {client.rncCedula || '-'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          client.pendingBalance > 0
                            ? 'font-semibold text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {formatCurrency(client.pendingBalance)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-muted-foreground">
                      {formatDate(client.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(client)}
                          title="Editar"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(client)}
                          title="Ver detalles"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openPriceListDialog(client)}
                          title="Lista de Precios"
                          className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                          <Tags className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteClient(client)}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t px-4 py-3">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage(Math.max(1, page - 1))}
                        className={
                          page === 1
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                    {renderPaginationItems()}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        className={
                          page === totalPages
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>

      {/* New/Edit Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </DialogTitle>
              <DialogDescription>
                {editingClient
                  ? 'Modifica los datos del cliente'
                  : 'Ingresa los datos del nuevo cliente'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre completo"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="809-000-0000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Dirección del cliente"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rncCedula">RNC/Cédula</Label>
                <Input
                  id="rncCedula"
                  value={formData.rncCedula}
                  onChange={(e) => setFormData({ ...formData, rncCedula: e.target.value })}
                  placeholder="000-0000000-0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isMutating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isMutating && <Loader2 className="size-4 animate-spin" />}
                {editingClient ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Price List Dialog */}
      <Dialog open={priceListDialogOpen} onOpenChange={(open) => !open && closePriceListDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-5 text-amber-600" />
              Lista de Precios - {priceListClientName}
            </DialogTitle>
            <DialogDescription>
              Gestiona los precios personalizados para este cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing custom prices */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Precios Personalizados</Label>
              {clientPricesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : clientPrices.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No hay precios personalizados para este cliente
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {clientPrices.map((cp: any) => (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cp.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cp.product.code} &middot; Precio normal: {formatCurrency(cp.product.salePrice)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                            {formatCurrency(cp.customPrice)}
                          </p>
                          {cp.customPrice !== cp.product.salePrice && (
                            <p className="text-[10px] text-muted-foreground">
                              {cp.customPrice < cp.product.salePrice ? '↓' : '↑'} vs normal
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive shrink-0"
                          onClick={() => deletePriceMutation.mutate(cp.id)}
                          disabled={deletePriceMutation.isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add product section */}
            <div className="border-t pt-4">
              <Label className="text-sm font-medium mb-2 block">Agregar Producto</Label>
              <div className="space-y-2">
                {/* Product search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto por nombre o código..."
                    value={productSearchForPrice}
                    onChange={(e) => {
                      setProductSearchForPrice(e.target.value)
                      setNewCustomProductId(null)
                    }}
                    className="pl-8 h-9 text-sm"
                  />
                </div>

                {/* Product search results */}
                {productSearchForPrice.length > 0 && !newCustomProductId && (
                  <div className="max-h-36 overflow-y-auto border rounded-md">
                    {priceListProducts
                      .filter((p: any) => p.status === 'ACTIVO')
                      .slice(0, 10)
                      .map((p: any) => {
                        const alreadyAdded = clientPrices.some((cp: any) => cp.productId === p.id)
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              if (!alreadyAdded) {
                                setNewCustomProductId(p.id)
                                setProductSearchForPrice(p.name)
                              }
                            }}
                            className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors ${
                              alreadyAdded ? 'opacity-50 pointer-events-none' : ''
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="truncate">{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{p.code}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(p.salePrice)}
                              </span>
                              {alreadyAdded && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-300 text-amber-700">
                                  ★
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}

                {/* Custom price input + add button */}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Precio personalizado"
                    value={newCustomPrice}
                    onChange={(e) => setNewCustomPrice(e.target.value)}
                    className="h-9 text-sm"
                    min={0}
                    step={0.01}
                  />
                  <Button
                    onClick={handleAddPrice}
                    disabled={!newCustomProductId || !newCustomPrice || addPriceMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                  >
                    {addPriceMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Agregar
                  </Button>
                </div>

                {newCustomProductId && (
                  <p className="text-xs text-muted-foreground">
                    Producto seleccionado. Ingrese el precio personalizado y haga clic en Agregar.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePriceListDialog}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteClient} onOpenChange={(open) => !open && setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el cliente{' '}
              <strong>{deleteClient?.name}</strong>.
              {deleteClient && deleteClient.invoiceCount > 0 && (
                <span className="mt-2 block rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  ⚠️ Este cliente tiene {deleteClient.invoiceCount} factura
                  {deleteClient.invoiceCount !== 1 ? 's' : ''} asociada
                  {deleteClient.invoiceCount !== 1 ? 's' : ''}. No se puede eliminar hasta que se
                  eliminen las facturas dependientes.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteClient && deleteMutation.mutate(deleteClient.id)}
              disabled={deleteMutation.isPending || (deleteClient?.invoiceCount ?? 0) > 0}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
