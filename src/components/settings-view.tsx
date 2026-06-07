'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatDate, formatBs, getStatusColor, getRoleLabel } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
import {
  Settings,
  Key,
  UserCog,
  Building2,
  Plus,
  Play,
  Ban,
  RefreshCw,
  Pencil,
  Shield,
  DollarSign,
  Loader2,
  Trash2,
  Upload,
  Image as ImageIcon,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  FileCode,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'

export function SettingsView() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('licenses')

  // ===== LICENSES =====
  const { data: licensesData, isLoading: licensesLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => api.get('/licenses'),
  })

  const { data: licenseStatus } = useQuery({
    queryKey: ['licenses-status'],
    queryFn: () => api.get('/licenses/status'),
  })

  const licenses = (licensesData?.licenses || []) as Record<string, unknown>[]

  // Create license
  const [createLicenseOpen, setCreateLicenseOpen] = useState(false)
  const [licenseClientName, setLicenseClientName] = useState('')
  const [licenseDuration, setLicenseDuration] = useState('365')

  const createLicenseMutation = useMutation({
    mutationFn: (data: { clientName: string; durationDays: number }) =>
      api.post('/licenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      queryClient.invalidateQueries({ queryKey: ['licenses-status'] })
      setCreateLicenseOpen(false)
      setLicenseClientName('')
      setLicenseDuration('365')
      toast.success('Licencia creada correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear licencia')
    },
  })

  // License actions
  const licenseActionMutation = useMutation({
    mutationFn: ({ id, action, durationDays }: { id: string; action: string; durationDays?: number }) =>
      api.put(`/licenses/${id}`, { action, durationDays }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      queryClient.invalidateQueries({ queryKey: ['licenses-status'] })
      toast.success('Acción completada correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al ejecutar acción')
    },
  })

  // ===== USERS =====
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  })

  const users = (usersData?.users || []) as Record<string, unknown>[]

  // Create user
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('EMPLEADO')

  const createUserMutation = useMutation({
    mutationFn: (data: { username: string; password: string; name: string; email: string; role: string }) =>
      api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setCreateUserOpen(false)
      setNewUsername('')
      setNewPassword('')
      setNewName('')
      setNewEmail('')
      setNewRole('EMPLEADO')
      toast.success('Usuario creado correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al crear usuario')
    },
  })

  // Edit user
  const [editUserOpen, setEditUserOpen] = useState(false)
  const [editUserId, setEditUserId] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editActive, setEditActive] = useState(true)

  const editUserMutation = useMutation({
    mutationFn: (data: { id: string; name: string; email: string; role: string; active: boolean }) =>
      api.put(`/users/${data.id}`, { name: data.name, email: data.email, role: data.role, active: data.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setEditUserOpen(false)
      toast.success('Usuario actualizado correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar usuario')
    },
  })

  // Deactivate user
  const deactivateUserMutation = useMutation({
    mutationFn: (id: string) => api.del(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuario desactivado correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al desactivar usuario')
    },
  })

  const handleEditUser = (u: Record<string, unknown>) => {
    setEditUserId(u.id as string)
    setEditName(u.name as string)
    setEditEmail((u.email as string) || '')
    setEditRole(u.role as string)
    setEditActive(u.active as boolean)
    setEditUserOpen(true)
  }

  const isDesarrollador = user?.role === 'DESARROLLADOR'

  const getDaysRemaining = (expirationDate: string) => {
    const now = new Date()
    const exp = new Date(expirationDate)
    const diff = exp.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  // ===== COMPANY CONFIG =====
  const { data: companyData, isLoading: companyLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => api.get('/company'),
  })

  const [companyForm, setCompanyForm] = useState<Record<string, string> | null>(null)

  // Derive form values: use local edits if any, otherwise from server data
  const formValues = companyForm ?? {
    name: (companyData as Record<string, unknown>)?.name as string || '',
    rnc: (companyData as Record<string, unknown>)?.rnc as string || '',
    address: (companyData as Record<string, unknown>)?.address as string || '',
    phone: (companyData as Record<string, unknown>)?.phone as string || '',
    email: (companyData as Record<string, unknown>)?.email as string || '',
    ncfSequence: (companyData as Record<string, unknown>)?.ncfSequence as string || '',
    taxRate: String(((companyData as Record<string, unknown>)?.taxRate as number) ?? 16),
    copyright: (companyData as Record<string, unknown>)?.copyright as string || 'Zeus Rodriguez',
    slogan: (companyData as Record<string, unknown>)?.slogan as string || '',
  }

  const saveCompanyMutation = useMutation({
    mutationFn: (data: any) => api.put('/company', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] })
      toast.success('Configuración guardada correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al guardar configuración')
    },
  })

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500000) {
      toast.error('El logo debe ser menor a 500KB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      saveCompanyMutation.mutate({ logo: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  // ===== PURGE TEST DATA =====
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)

  const purgeDataMutation = useMutation({
    mutationFn: () => api.post('/system/purge-test-data', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries()
      toast.success(data.message || 'Datos de prueba eliminados correctamente')
      setPurgeDialogOpen(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al eliminar datos de prueba')
    },
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Configuración
        </h1>
        <p className="text-muted-foreground">Gestión de licencias, usuarios y configuración del sistema</p>
      </div>

      {/* License Status Banner */}
      {licenseStatus && (
        <Card className={`${licenseStatus.active ? 'border-emerald-300 dark:border-emerald-700' : 'border-red-300 dark:border-red-700'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key className={`w-5 h-5 ${licenseStatus.active ? 'text-emerald-600' : 'text-red-600'}`} />
                <div>
                  <p className="text-sm font-medium">
                    Estado de Licencia: {licenseStatus.active ? 'Activa' : 'Inactiva/Vencida'}
                  </p>
                  {licenseStatus.license && (
                    <p className="text-xs text-muted-foreground">
                      Clave: {licenseStatus.license.licenseKey}
                      {licenseStatus.daysRemaining !== null && (
                        <> &middot; Días restantes: <span className={licenseStatus.daysRemaining <= 30 ? 'text-red-600 font-medium' : ''}>{licenseStatus.daysRemaining}</span></>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <Badge className={licenseStatus.active ? getStatusColor('ACTIVA') : getStatusColor('VENCIDA')}>
                {licenseStatus.active ? 'ACTIVA' : 'VENCIDA'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="licenses" className="gap-1.5">
            <Key className="w-4 h-4" />
            Licencias
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <UserCog className="w-4 h-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="dollar-rates" className="gap-1.5">
            <DollarSign className="w-4 h-4" />
            Tasa del Dólar
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            Configuración
          </TabsTrigger>
          {(isDesarrollador || user?.role === 'ADMINISTRADOR') && (
            <TabsTrigger value="updates" className="gap-1.5">
              <DownloadCloud className="w-4 h-4" />
              Actualizaciones
            </TabsTrigger>
          )}
        </TabsList>

        {/* ===== LICENSES TAB ===== */}
        <TabsContent value="licenses" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {isDesarrollador && (
              <Dialog open={createLicenseOpen} onOpenChange={setCreateLicenseOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Licencia
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Nueva Licencia</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nombre del Cliente</Label>
                      <Input
                        placeholder="Nombre del cliente..."
                        value={licenseClientName}
                        onChange={(e) => setLicenseClientName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duración (días)</Label>
                      <Input
                        type="number"
                        value={licenseDuration}
                        onChange={(e) => setLicenseDuration(e.target.value)}
                        min="1"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button
                      onClick={() => createLicenseMutation.mutate({
                        clientName: licenseClientName,
                        durationDays: parseInt(licenseDuration) || 365,
                      })}
                      disabled={!licenseClientName || createLicenseMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {createLicenseMutation.isPending ? 'Creando...' : 'Crear Licencia'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {licensesLoading ? (
                <div className="animate-pulse p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              ) : licenses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay licencias registradas</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Clave</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Activación</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead>Días Restantes</TableHead>
                        {isDesarrollador && <TableHead>Acciones</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {licenses.map((lic: Record<string, unknown>) => {
                        const daysLeft = getDaysRemaining(lic.expirationDate as string)
                        return (
                          <TableRow key={lic.id as string}>
                            <TableCell className="font-mono text-xs">{lic.licenseKey as string}</TableCell>
                            <TableCell>{lic.clientName as string}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(lic.status as string)}>
                                {lic.status as string}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(lic.activationDate as string)}</TableCell>
                            <TableCell className="text-sm">{formatDate(lic.expirationDate as string)}</TableCell>
                            <TableCell>
                              <span className={`font-medium ${daysLeft <= 30 ? 'text-red-600' : daysLeft <= 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {daysLeft}
                              </span>
                            </TableCell>
                            {isDesarrollador && (
                              <TableCell>
                                <div className="flex gap-1">
                                  {lic.status !== 'ACTIVA' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => licenseActionMutation.mutate({ id: lic.id as string, action: 'activate' })}
                                      title="Activar"
                                    >
                                      <Play className="w-4 h-4 text-emerald-600" />
                                    </Button>
                                  )}
                                  {lic.status === 'ACTIVA' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => licenseActionMutation.mutate({ id: lic.id as string, action: 'suspend' })}
                                      title="Suspender"
                                    >
                                      <Ban className="w-4 h-4 text-red-600" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => licenseActionMutation.mutate({ id: lic.id as string, action: 'renew' })}
                                    title="Renovar"
                                  >
                                    <RefreshCw className="w-4 h-4 text-amber-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== USERS TAB ===== */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex justify-end">
            {(isDesarrollador || user?.role === 'ADMINISTRADOR') && (
              <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nombre de Usuario</Label>
                      <Input
                        placeholder="username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contraseña</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre Completo</Label>
                      <Input
                        placeholder="Nombre completo"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="email@ejemplo.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rol</Label>
                      <Select value={newRole} onValueChange={setNewRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EMPLEADO">Empleado</SelectItem>
                          <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
                          {isDesarrollador && (
                            <SelectItem value="DESARROLLADOR">Desarrollador</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button
                      onClick={() => createUserMutation.mutate({
                        username: newUsername,
                        password: newPassword,
                        name: newName,
                        email: newEmail,
                        role: newRole,
                      })}
                      disabled={!newUsername || !newPassword || !newName || createUserMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {createUserMutation.isPending ? 'Creando...' : 'Crear Usuario'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="animate-pulse p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserCog className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay usuarios registrados</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        {(isDesarrollador || user?.role === 'ADMINISTRADOR') && (
                          <TableHead>Acciones</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u: Record<string, unknown>) => {
                        const isSelf = u.id === user?.id
                        return (
                          <TableRow key={u.id as string}>
                            <TableCell className="font-medium">{u.name as string}</TableCell>
                            <TableCell className="text-sm">{u.username as string}</TableCell>
                            <TableCell className="text-sm">{(u.email as string) || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                <Shield className="w-3 h-3" />
                                {getRoleLabel(u.role as string)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(u.active ? 'ACTIVO' : 'INACTIVO')}>
                                {u.active ? 'ACTIVO' : 'INACTIVO'}
                              </Badge>
                            </TableCell>
                            {(isDesarrollador || user?.role === 'ADMINISTRADOR') && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditUser(u)}
                                    title="Editar"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  {!isSelf && u.active && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deactivateUserMutation.mutate(u.id as string)}
                                      title="Desactivar"
                                      disabled={deactivateUserMutation.isPending}
                                    >
                                      <Ban className="w-4 h-4 text-red-600" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Edit User Dialog */}
          <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Usuario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={editRole}
                    onValueChange={setEditRole}
                    disabled={!isDesarrollador || editUserId === user?.id}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLEADO">Empleado</SelectItem>
                      <SelectItem value="ADMINISTRADOR">Administrador</SelectItem>
                      {isDesarrollador && (
                        <SelectItem value="DESARROLLADOR">Desarrollador</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={editActive}
                    onCheckedChange={setEditActive}
                    disabled={editUserId === user?.id}
                  />
                  <Label>Usuario Activo</Label>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button
                  onClick={() => editUserMutation.mutate({
                    id: editUserId,
                    name: editName,
                    email: editEmail,
                    role: editRole,
                    active: editActive,
                  })}
                  disabled={editUserMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {editUserMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== DOLLAR RATES TAB ===== */}
        <TabsContent value="dollar-rates" className="space-y-4 mt-4">
          <DollarRatesSection />
        </TabsContent>

        {/* ===== UPDATES TAB ===== */}
        {(isDesarrollador || user?.role === 'ADMINISTRADOR') && (
          <TabsContent value="updates" className="space-y-4 mt-4">
            <SystemUpdatesSection />
          </TabsContent>
        )}

        {/* ===== CONFIGURACIÓN TAB ===== */}
        <TabsContent value="config" className="space-y-4 mt-4">
          {/* Company Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Configuración de la Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {companyLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 bg-muted rounded" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Logo */}
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {companyData?.logo ? (
                        <img
                          src={companyData.logo}
                          alt="Logo de la empresa"
                          className="w-16 h-16 rounded-lg object-cover border"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center border">
                          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {(formValues.name || 'F').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label className="text-sm text-muted-foreground">Logo de la Empresa</Label>
                      <p className="text-xs text-muted-foreground mb-2">PNG, JPG o SVG. Máximo 500KB.</p>
                      <label className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground">
                        <Upload className="w-4 h-4" />
                        Subir Logo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <Separator />

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Nombre de la Empresa</Label>
                      <Input
                        id="companyName"
                        value={formValues.name}
                        onChange={(e) => setCompanyForm({ ...formValues, name: e.target.value })}
                        placeholder="FacturaPro"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyRnc">RNC</Label>
                      <Input
                        id="companyRnc"
                        value={formValues.rnc}
                        onChange={(e) => setCompanyForm({ ...formValues, rnc: e.target.value })}
                        placeholder="RNC de la empresa"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyAddress">Dirección</Label>
                      <Input
                        id="companyAddress"
                        value={formValues.address}
                        onChange={(e) => setCompanyForm({ ...formValues, address: e.target.value })}
                        placeholder="Dirección de la empresa"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyPhone">Teléfono</Label>
                      <Input
                        id="companyPhone"
                        value={formValues.phone}
                        onChange={(e) => setCompanyForm({ ...formValues, phone: e.target.value })}
                        placeholder="+58 xxx-xxxxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyEmail">Email</Label>
                      <Input
                        id="companyEmail"
                        type="email"
                        value={formValues.email}
                        onChange={(e) => setCompanyForm({ ...formValues, email: e.target.value })}
                        placeholder="contacto@empresa.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyNcf">Secuencia NCF</Label>
                      <Input
                        id="companyNcf"
                        value={formValues.ncfSequence}
                        onChange={(e) => setCompanyForm({ ...formValues, ncfSequence: e.target.value })}
                        placeholder="B0100000001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyTaxRate">Tasa IVA (%)</Label>
                      <Input
                        id="companyTaxRate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formValues.taxRate}
                        onChange={(e) => setCompanyForm({ ...formValues, taxRate: e.target.value })}
                        placeholder="16"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companySlogan">Lema / Eslogan</Label>
                      <Input
                        id="companySlogan"
                        value={formValues.slogan}
                        onChange={(e) => setCompanyForm({ ...formValues, slogan: e.target.value })}
                        placeholder="CALIDAD Y SEGURIDAD AL POR MAYOR"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyCopyright">Copyright</Label>
                      <Input
                        id="companyCopyright"
                        value={formValues.copyright}
                        onChange={(e) => setCompanyForm({ ...formValues, copyright: e.target.value })}
                        placeholder="Zeus Rodriguez"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={() => saveCompanyMutation.mutate({
                        name: formValues.name,
                        rnc: formValues.rnc,
                        address: formValues.address,
                        phone: formValues.phone,
                        email: formValues.email,
                        ncfSequence: formValues.ncfSequence,
                        taxRate: parseFloat(formValues.taxRate) || 16,
                        copyright: formValues.copyright,
                        slogan: formValues.slogan,
                      })}
                      disabled={saveCompanyMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {saveCompanyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Guardar Configuración
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Versión:</span>{' '}
                  <span className="font-medium">1.0.0</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Framework:</span>{' '}
                  <span className="font-medium">Next.js 16</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Base de Datos:</span>{' '}
                  <span className="font-medium">SQLite</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Licencia:</span>{' '}
                  <span className="font-medium">
                    {licenseStatus?.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="text-muted-foreground">Copyright:</span>{' '}
                  <span className="font-medium">{formValues.copyright || 'Zeus Rodriguez'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone - Only for DESARROLLADOR */}
          {isDesarrollador && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Trash2 className="w-5 h-5" />
                  Zona de Peligro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Eliminar todos los datos de prueba del sistema. Se preservarán: usuarios, licencias, tasas del dólar y configuración de la empresa.
                </p>
                <Button
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => setPurgeDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar Datos de Prueba
                </Button>

                <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar todos los datos de prueba?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará TODOS los datos de prueba del sistema (clientes, productos, facturas, órdenes de compra, movimientos de stock, etc.).
                        Se preservarán: usuarios, licencias, tasas del dólar y configuración de la empresa.
                        Esta acción NO se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => purgeDataMutation.mutate()}
                        disabled={purgeDataMutation.isPending}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {purgeDataMutation.isPending ? 'Eliminando...' : 'Sí, eliminar todo'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DollarRatesSection() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [manualOfficialRate, setManualOfficialRate] = useState('')
  const [manualParallelRate, setManualParallelRate] = useState('')
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])

  const { data: ratesData, isLoading } = useQuery({
    queryKey: ['dollar-rates-list'],
    queryFn: () => api.get('/dollar-rates'),
  })

  const fetchRateMutation = useMutation({
    mutationFn: () => api.post('/dollar-rates', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dollar-rates-list'] })
      queryClient.invalidateQueries({ queryKey: ['header-dollar-rate'] })
      queryClient.invalidateQueries({ queryKey: ['dollar-rate-today'] })
      toast.success(`Tasa actualizada: Oficial Bs. ${data.officialRate.toFixed(2)}, Paralelo Bs. ${data.parallelRate.toFixed(2)}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al actualizar tasa desde la API')
    },
  })

  const manualRateMutation = useMutation({
    mutationFn: (data: { officialRate: number; parallelRate?: number; date: string }) =>
      api.put('/dollar-rates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dollar-rates-list'] })
      queryClient.invalidateQueries({ queryKey: ['header-dollar-rate'] })
      queryClient.invalidateQueries({ queryKey: ['dollar-rate-today'] })
      setManualOfficialRate('')
      setManualParallelRate('')
      toast.success('Tasa guardada correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al guardar tasa manual')
    },
  })

  const rates = ratesData?.rates || []
  const todayRate = ratesData?.todayRate || null
  const isAdmin = user?.role === 'DESARROLLADOR' || user?.role === 'ADMINISTRADOR'

  return (
    <>
      {/* Current Rate Card */}
      <Card className="border-emerald-200 dark:border-emerald-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Tasa del Dólar Actual
            </CardTitle>
            {isAdmin && (
              <Button
                onClick={() => fetchRateMutation.mutate()}
                disabled={fetchRateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
              >
                {fetchRateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Actualizar desde API
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {todayRate ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dólar Oficial (BCV)</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    Bs. {todayRate.officialRate.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dólar Paralelo</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    Bs. {todayRate.parallelRate.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No hay tasa del dólar registrada</p>
              <p className="text-xs mt-1">Haga clic en &quot;Actualizar desde API&quot; para obtener la tasa actual</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Fuente: ve.dolarapi.com - La tasa oficial del BCV se utiliza para todas las conversiones a Bolívares.
            Los días sin tasa (fines de semana, feriados) se utiliza la última tasa disponible.
          </p>
        </CardContent>
      </Card>

      {/* Manual Rate Entry */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              Ingresar Tasa Manual
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Use esta opción cuando no tenga acceso a internet para obtener la tasa automáticamente
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tasa Oficial BCV (Bs/USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ej: 36.50"
                  value={manualOfficialRate}
                  onChange={(e) => setManualOfficialRate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tasa Paralela (Bs/USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Opcional"
                  value={manualParallelRate}
                  onChange={(e) => setManualParallelRate(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={() => manualRateMutation.mutate({
                officialRate: parseFloat(manualOfficialRate),
                parallelRate: manualParallelRate ? parseFloat(manualParallelRate) : undefined,
                date: manualDate,
              })}
              disabled={!manualOfficialRate || parseFloat(manualOfficialRate) <= 0 || manualRateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {manualRateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              Guardar Tasa Manual
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Rate History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de Tasas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="animate-pulse p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay tasas registradas</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Oficial (BCV)</TableHead>
                    <TableHead className="text-right">Paralelo</TableHead>
                    <TableHead>Fuente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((rate: { id: string; date: string; officialRate: number; parallelRate: number; source: string }) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">{formatDate(rate.date)}</TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                        Bs. {rate.officialRate.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400 font-semibold">
                        Bs. {rate.parallelRate.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rate.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function SystemUpdatesSection() {
  const [folderUrl, setFolderUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [checking, setChecking] = useState(false)
  const [updatesData, setUpdatesData] = useState<any>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [applyResults, setApplyResults] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const availableUpdates = (updatesData?.availableUpdates || []) as Record<string, any>[]

  const handleCheckUpdates = async () => {
    if (!folderUrl || !apiKey) {
      toast.error('Ingrese la URL de la carpeta y la API Key')
      return
    }
    setChecking(true)
    setUpdatesData(null)
    setApplyResults(null)
    setSelectedFiles(new Set())
    try {
      const data = await api.get(`/system/check-updates?folderUrl=${encodeURIComponent(folderUrl)}&apiKey=${encodeURIComponent(apiKey)}`)
      setUpdatesData(data)
      if (data.availableUpdates?.length > 0) {
        toast.success(`${data.availableUpdates.length} actualizaciones disponibles`)
      } else {
        toast.info('No hay actualizaciones disponibles')
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al verificar actualizaciones')
    } finally {
      setChecking(false)
    }
  }

  const toggleFile = (fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) {
        next.delete(fileId)
      } else {
        next.add(fileId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedFiles(new Set(availableUpdates.map((f: Record<string, any>) => f.id as string)))
  }

  const deselectAll = () => {
    setSelectedFiles(new Set())
  }

  const applyUpdatesMutation = useMutation({
    mutationFn: (data: { files: string[]; apiKey: string }) =>
      api.post('/system/check-updates', data),
    onSuccess: (data) => {
      setApplyResults(data)
      setApplying(false)
      setConfirmOpen(false)
      toast.success('Actualizaciones aplicadas correctamente')
    },
    onError: (error: Error) => {
      setApplying(false)
      setConfirmOpen(false)
      toast.error(error.message || 'Error al aplicar actualizaciones')
    },
  })

  const handleApplyUpdates = () => {
    if (selectedFiles.size === 0) {
      toast.error('Seleccione al menos un archivo para actualizar')
      return
    }
    setConfirmOpen(true)
  }

  const confirmApply = () => {
    setApplying(true)
    applyUpdatesMutation.mutate({
      files: Array.from(selectedFiles),
      apiKey,
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DownloadCloud className="w-5 h-5" />
            Actualizar Sistema desde Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Folder URL Input */}
          <div className="space-y-2">
            <Label htmlFor="folderUrl">URL de Carpeta de Google Drive</Label>
            <Input
              id="folderUrl"
              placeholder="https://drive.google.com/drive/folders/..."
              value={folderUrl}
              onChange={(e) => setFolderUrl(e.target.value)}
            />
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key de Google Drive</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="AIza..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Info Box */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">¿Cómo obtener la API Key?</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Ve a{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      Google Cloud Console <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Crea un proyecto o selecciona uno existente</li>
                  <li>Habilita la API de Google Drive</li>
                  <li>Crea una credencial de API Key</li>
                  <li>Asegúrate de que la carpeta sea pública o compartida con la cuenta de servicio</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Check Updates Button */}
          <Button
            onClick={handleCheckUpdates}
            disabled={checking || !folderUrl || !apiKey}
            className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
          >
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Verificando...
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4 mr-2" />
                Verificar Actualizaciones
              </>
            )}
          </Button>

          {/* Updates Data Summary */}
          {updatesData && (
            <>
              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-bold">{updatesData.totalFiles ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Total de archivos</p>
                </div>
                <div className="rounded-lg border p-4 text-center border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{availableUpdates.length}</p>
                  <p className="text-sm text-muted-foreground">Actualizaciones disponibles</p>
                </div>
                <div className="rounded-lg border p-4 text-center border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{updatesData.unchanged ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Sin cambios</p>
                </div>
              </div>

              {/* Available Updates Table */}
              {availableUpdates.length > 0 && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <h3 className="text-sm font-medium">
                      Archivos disponibles para actualizar ({availableUpdates.length})
                    </h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAll}>
                        Seleccionar Todos
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAll}>
                        Deseleccionar
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Archivo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="hidden sm:table-cell">Modificado (Drive)</TableHead>
                          <TableHead className="hidden md:table-cell">Modificado (Local)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableUpdates.map((file: Record<string, any>) => (
                          <TableRow
                            key={file.id as string}
                            className={selectedFiles.has(file.id as string) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedFiles.has(file.id as string)}
                                onChange={() => toggleFile(file.id as string)}
                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileCode className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium text-sm truncate max-w-[200px] sm:max-w-none">
                                  {file.name as string}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  file.status === 'new'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                }
                              >
                                {file.status === 'new' ? 'Nuevo' : 'Actualizado'}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                              {file.driveModified ? formatDate(file.driveModified as string) : '-'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {file.localModified ? formatDate(file.localModified as string) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Apply Updates Button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleApplyUpdates}
                      disabled={selectedFiles.size === 0 || applying}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {applying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Aplicando...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Aplicar Actualizaciones ({selectedFiles.size})
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Apply Results */}
          {applyResults && (
            <>
              <Separator />
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-medium">Resultado de la actualización</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {applyResults.applied?.length > 0 && (
                    <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/20 p-3">
                      <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                        Aplicados ({applyResults.applied.length})
                      </p>
                      <ul className="space-y-0.5 text-emerald-600 dark:text-emerald-400">
                        {applyResults.applied.map((name: string, i: number) => (
                          <li key={i} className="truncate">{name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {applyResults.failed?.length > 0 && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-3">
                      <p className="font-medium text-red-700 dark:text-red-400 mb-1">
                        Fallidos ({applyResults.failed.length})
                      </p>
                      <ul className="space-y-0.5 text-red-600 dark:text-red-400">
                        {applyResults.failed.map((item: { name: string; error: string }, i: number) => (
                          <li key={i} className="truncate">{item.name}: {item.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation AlertDialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Actualización</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea aplicar {selectedFiles.size} actualización(es)?
              Esto modificará archivos del sistema y los cambios no se pueden deshacer automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApply}
              disabled={applying}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Aplicando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
