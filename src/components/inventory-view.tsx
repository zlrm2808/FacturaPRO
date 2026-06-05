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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Trash2,
  Package,
  Loader2,
  ArrowUpDown,
  Tag,
  AlertTriangle,
} from 'lucide-react'

// Types
interface Category {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  productCount: number
}

interface Product {
  id: string
  code: string
  name: string
  description: string | null
  purchasePrice: number
  salePrice: number
  quantity: number
  minStock: number
  status: string
  categoryId: string | null
  createdAt: string
  updatedAt: string
  category: { id: string; name: string } | null
}

interface StockMovement {
  id: string
  productId: string
  type: string
  quantity: number
  reason: string | null
  reference: string | null
  createdAt: string
}

interface ProductDetail extends Product {
  stockMovements: StockMovement[]
}

interface ProductFormData {
  code: string
  name: string
  description: string
  purchasePrice: string
  salePrice: string
  quantity: string
  minStock: string
  categoryId: string
  status: string
}

interface CategoryFormData {
  name: string
  description: string
}

interface StockMovementFormData {
  type: string
  quantity: string
  reason: string
}

const emptyProductForm: ProductFormData = {
  code: '',
  name: '',
  description: '',
  purchasePrice: '0',
  salePrice: '',
  quantity: '0',
  minStock: '5',
  categoryId: '',
  status: 'ACTIVO',
}

const emptyCategoryForm: CategoryFormData = {
  name: '',
  description: '',
}

const emptyMovementForm: StockMovementFormData = {
  type: 'ENTRADA',
  quantity: '',
  reason: '',
}

const ITEMS_PER_PAGE = 10

export function InventoryView() {
  const queryClient = useQueryClient()
  const { lowStockFilterActive, setLowStockFilterActive, setCurrentPage: navigateToPage } = useAppStore()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [lowStockFilter, setLowStockFilter] = useState(lowStockFilterActive)
  const [currentPage, setCurrentPage] = useState(1)

  // Sync with store: if lowStockFilterActive changes to true, activate the local filter
  if (lowStockFilterActive && !lowStockFilter) {
    setLowStockFilter(true)
    setLowStockFilterActive(false)
  }

  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [productForm, setProductForm] = useState<ProductFormData>(emptyProductForm)

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(emptyCategoryForm)

  const [movementDialogOpen, setMovementDialogOpen] = useState(false)
  const [movementProduct, setMovementProduct] = useState<Product | null>(null)
  const [movementForm, setMovementForm] = useState<StockMovementFormData>(emptyMovementForm)

  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailProduct, setDetailProduct] = useState<ProductDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)

  // Debounce search
  const debounceTimer = useState<ReturnType<typeof setTimeout> | null>(null)
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value)
      if (debounceTimer[0]) clearTimeout(debounceTimer[0])
      const timer = setTimeout(() => {
        setDebouncedSearch(value)
        setCurrentPage(1)
      }, 400)
      debounceTimer[1](timer)
    },
    []
  )

  // Fetch products
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', debouncedSearch, selectedCategory, lowStockFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (selectedCategory) params.set('category', selectedCategory)
      if (lowStockFilter) params.set('lowStock', 'true')
      const qs = params.toString()
      return api.get(`/products${qs ? `?${qs}` : ''}`)
    },
  })

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  })

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: (data: ProductFormData) =>
      api.post('/products', {
        ...data,
        purchasePrice: parseFloat(data.purchasePrice) || 0,
        salePrice: parseFloat(data.salePrice) || 0,
        quantity: parseInt(data.quantity) || 0,
        minStock: parseInt(data.minStock) || 5,
        categoryId: data.categoryId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Producto creado exitosamente')
      closeProductDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear producto')
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductFormData }) =>
      api.put(`/products/${id}`, {
        ...data,
        purchasePrice: parseFloat(data.purchasePrice) || 0,
        salePrice: parseFloat(data.salePrice) || 0,
        quantity: parseInt(data.quantity) || 0,
        minStock: parseInt(data.minStock) || 5,
        categoryId: data.categoryId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Producto actualizado exitosamente')
      closeProductDialog()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar producto')
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => api.del(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Producto eliminado exitosamente')
      setDeleteProduct(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar producto')
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: (data: CategoryFormData) => api.post('/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Categoría creada exitosamente')
      setCategoryDialogOpen(false)
      setCategoryForm(emptyCategoryForm)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear categoría')
    },
  })

  const stockMovementMutation = useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: StockMovementFormData }) => {
      const qty = parseInt(data.quantity) || 0
      const currentProduct = products.find((p) => p.id === productId)
      const currentQty = currentProduct?.quantity || 0
      const newQty = data.type === 'ENTRADA' ? currentQty + qty : currentQty - qty
      return api.put(`/products/${productId}`, {
        quantity: newQty,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Movimiento de stock registrado exitosamente')
      setMovementDialogOpen(false)
      setMovementProduct(null)
      setMovementForm(emptyMovementForm)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al registrar movimiento')
    },
  })

  // Dialog handlers
  const openNewProductDialog = () => {
    setEditingProduct(null)
    setProductForm(emptyProductForm)
    setProductDialogOpen(true)
  }

  const openEditProductDialog = (product: Product) => {
    setEditingProduct(product)
    setProductForm({
      code: product.code,
      name: product.name,
      description: product.description || '',
      purchasePrice: String(product.purchasePrice),
      salePrice: String(product.salePrice),
      quantity: String(product.quantity),
      minStock: String(product.minStock),
      categoryId: product.categoryId || '',
      status: product.status,
    })
    setProductDialogOpen(true)
  }

  const closeProductDialog = () => {
    setProductDialogOpen(false)
    setEditingProduct(null)
    setProductForm(emptyProductForm)
  }

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productForm.code.trim()) {
      toast.error('El código es requerido')
      return
    }
    if (!productForm.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }
    if (!productForm.salePrice || parseFloat(productForm.salePrice) < 0) {
      toast.error('El precio de venta es requerido y debe ser mayor o igual a 0')
      return
    }
    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: productForm })
    } else {
      createProductMutation.mutate(productForm)
    }
  }

  const openMovementDialog = (product: Product) => {
    setMovementProduct(product)
    setMovementForm(emptyMovementForm)
    setMovementDialogOpen(true)
  }

  const handleMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!movementForm.quantity || parseInt(movementForm.quantity) <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }
    if (movementProduct) {
      stockMovementMutation.mutate({ productId: movementProduct.id, data: movementForm })
    }
  }

  const openDetailDialog = async (product: Product) => {
    setDetailDialogOpen(true)
    setDetailLoading(true)
    try {
      const data = await api.get(`/products/${product.id}`)
      setDetailProduct(data)
    } catch {
      toast.error('Error al cargar detalle del producto')
      setDetailDialogOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // Stock status helper
  const getStockStyle = (quantity: number, minStock: number) => {
    if (quantity <= minStock) {
      return 'font-semibold text-red-600 dark:text-red-400'
    }
    if (quantity <= minStock * 1.5) {
      return 'font-medium text-amber-600 dark:text-amber-400'
    }
    return 'text-foreground'
  }

  const getStockBadge = (quantity: number, minStock: number) => {
    if (quantity <= 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          Agotado
        </Badge>
      )
    }
    if (quantity <= minStock) {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">
          Bajo
        </Badge>
      )
    }
    if (quantity <= minStock * 1.5) {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
          Medio
        </Badge>
      )
    }
    return null
  }

  // Pagination
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE)
  const paginatedProducts = products.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const renderPaginationItems = () => {
    const items = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)

    for (let i = start; i <= end; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            isActive={i === currentPage}
            onClick={() => setCurrentPage(i)}
            className="cursor-pointer"
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      )
    }
    return items
  }

  const isProductMutating =
    createProductMutation.isPending || updateProductMutation.isPending

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Package className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestión de Inventario</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} producto{products.length !== 1 ? 's' : ''} registrado
              {products.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setCategoryForm(emptyCategoryForm)
              setCategoryDialogOpen(true)
            }}
            variant="outline"
          >
            <Tag className="size-4" />
            Nueva Categoría
          </Button>
          <Button
            onClick={openNewProductDialog}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="size-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={selectedCategory}
          onValueChange={(val) => {
            setSelectedCategory(val === '__all__' ? '' : val)
            setCurrentPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las categorías</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch
            id="lowStockFilter"
            checked={lowStockFilter}
            onCheckedChange={(checked) => {
              setLowStockFilter(checked)
              setCurrentPage(1)
            }}
          />
          <Label htmlFor="lowStockFilter" className="flex items-center gap-1.5 cursor-pointer">
            <AlertTriangle className="size-4 text-amber-500" />
            Stock Bajo
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="size-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              No se encontraron productos
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              {debouncedSearch || selectedCategory || lowStockFilter
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Agrega tu primer producto haciendo clic en "Nuevo Producto"'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                    <TableHead className="hidden lg:table-cell">P. Compra</TableHead>
                    <TableHead>P. Venta</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="hidden xl:table-cell">Min Stock</TableHead>
                    <TableHead className="hidden sm:table-cell">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.code}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {product.category?.name || '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {formatCurrency(product.purchasePrice)}
                      </TableCell>
                      <TableCell>{formatCurrency(product.salePrice)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={getStockStyle(product.quantity, product.minStock)}>
                            {product.quantity}
                          </span>
                          {getStockBadge(product.quantity, product.minStock)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-muted-foreground">
                        {product.minStock}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge className={getStatusColor(product.status)}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditProductDialog(product)}
                            title="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openMovementDialog(product)}
                            title="Movimiento de stock"
                          >
                            <ArrowUpDown className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetailDialog(product)}
                            title="Ver detalle"
                          >
                            <Package className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteProduct(product)}
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
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t px-4 py-3">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        className={
                          currentPage === 1
                            ? 'pointer-events-none opacity-50'
                            : 'cursor-pointer'
                        }
                      />
                    </PaginationItem>
                    {renderPaginationItems()}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        className={
                          currentPage === totalPages
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

      {/* New/Edit Product Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleProductSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? 'Modifica los datos del producto'
                  : 'Ingresa los datos del nuevo producto'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">
                    Código <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="code"
                    value={productForm.code}
                    onChange={(e) => setProductForm({ ...productForm, code: e.target.value })}
                    placeholder="PROD-001"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Nombre del producto"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm({ ...productForm, description: e.target.value })
                  }
                  placeholder="Descripción del producto"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="purchasePrice">Precio Compra</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.purchasePrice}
                    onChange={(e) =>
                      setProductForm({ ...productForm, purchasePrice: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="salePrice">
                    Precio Venta <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="salePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productForm.salePrice}
                    onChange={(e) =>
                      setProductForm({ ...productForm, salePrice: e.target.value })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Cantidad</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={productForm.quantity}
                    onChange={(e) =>
                      setProductForm({ ...productForm, quantity: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="minStock">Stock Mínimo</Label>
                  <Input
                    id="minStock"
                    type="number"
                    min="0"
                    value={productForm.minStock}
                    onChange={(e) =>
                      setProductForm({ ...productForm, minStock: e.target.value })
                    }
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="categoryId">Categoría</Label>
                  <Select
                    value={productForm.categoryId || '__none__'}
                    onValueChange={(val) =>
                      setProductForm({
                        ...productForm,
                        categoryId: val === '__none__' ? '' : val,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin categoría</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={productForm.status}
                    onValueChange={(val) =>
                      setProductForm({ ...productForm, status: val })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                      <SelectItem value="INACTIVO">INACTIVO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeProductDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isProductMutating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isProductMutating && <Loader2 className="size-4 animate-spin" />}
                {editingProduct ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!categoryForm.name.trim()) {
                toast.error('El nombre es requerido')
                return
              }
              createCategoryMutation.mutate(categoryForm)
            }}
          >
            <DialogHeader>
              <DialogTitle>Nueva Categoría</DialogTitle>
              <DialogDescription>
                Ingresa los datos de la nueva categoría
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="catName">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="catName"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  placeholder="Nombre de la categoría"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="catDescription">Descripción</Label>
                <Textarea
                  id="catDescription"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, description: e.target.value })
                  }
                  placeholder="Descripción de la categoría"
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createCategoryMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {createCategoryMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleMovementSubmit}>
            <DialogHeader>
              <DialogTitle>Movimiento de Stock</DialogTitle>
              <DialogDescription>
                {movementProduct
                  ? `Producto: ${movementProduct.name} (${movementProduct.code}) — Stock actual: ${movementProduct.quantity}`
                  : 'Registrar movimiento de inventario'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="movementType">Tipo</Label>
                <Select
                  value={movementForm.type}
                  onValueChange={(val) =>
                    setMovementForm({ ...movementForm, type: val })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRADA">ENTRADA (Agregar stock)</SelectItem>
                    <SelectItem value="SALIDA">SALIDA (Retirar stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="movementQty">
                  Cantidad <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="movementQty"
                  type="number"
                  min="1"
                  value={movementForm.quantity}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, quantity: e.target.value })
                  }
                  placeholder="0"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="movementReason">Razón</Label>
                <Input
                  id="movementReason"
                  value={movementForm.reason}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, reason: e.target.value })
                  }
                  placeholder="Razón del movimiento"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMovementDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={stockMovementMutation.isPending}
                className={
                  movementForm.type === 'ENTRADA'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                }
              >
                {stockMovementMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {movementForm.type === 'ENTRADA' ? 'Agregar Stock' : 'Retirar Stock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Detalle del Producto</DialogTitle>
                <DialogDescription>
                  Información completa y movimientos de stock
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                onClick={() => {
                  setDetailDialogOpen(false)
                  navigateToPage('reports')
                }}
              >
                Ver en Reportes
              </Button>
            </div>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : detailProduct ? (
            <div className="flex flex-col gap-6">
              {/* Product Info */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Código</p>
                  <p className="font-mono font-medium">{detailProduct.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="font-medium">{detailProduct.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Categoría</p>
                  <p className="font-medium">{detailProduct.category?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge className={getStatusColor(detailProduct.status)}>
                    {detailProduct.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Precio Compra</p>
                  <p className="font-medium">{formatCurrency(detailProduct.purchasePrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Precio Venta</p>
                  <p className="font-medium">{formatCurrency(detailProduct.salePrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stock Actual</p>
                  <p className={getStockStyle(detailProduct.quantity, detailProduct.minStock)}>
                    {detailProduct.quantity} unidades
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stock Mínimo</p>
                  <p className="font-medium">{detailProduct.minStock} unidades</p>
                </div>
                {detailProduct.description && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Descripción</p>
                    <p className="text-sm">{detailProduct.description}</p>
                  </div>
                )}
              </div>

              {/* Stock Movements */}
              <div>
                <h3 className="mb-3 font-semibold">Historial de Movimientos</h3>
                {detailProduct.stockMovements.length === 0 ? (
                  <div className="rounded-lg border py-8 text-center text-muted-foreground">
                    No hay movimientos registrados
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Razón</TableHead>
                          <TableHead>Referencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailProduct.stockMovements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell className="text-muted-foreground">
                              {formatDate(movement.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  movement.type === 'ENTRADA'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                }
                              >
                                {movement.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{movement.quantity}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {movement.reason || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {movement.reference || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteProduct}
        onOpenChange={(open) => !open && setDeleteProduct(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el producto{' '}
              <strong>{deleteProduct?.name}</strong> ({deleteProduct?.code}).
              <span className="mt-2 block rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                ⚠️ Si el producto está asociado a facturas, no se podrá eliminar.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProduct && deleteProductMutation.mutate(deleteProduct.id)}
              disabled={deleteProductMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteProductMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
