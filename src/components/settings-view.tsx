'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/store'
import { api } from '@/lib/api'
import { formatDate, getStatusColor, getRoleLabel } from '@/lib/format'
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
          <TabsTrigger value="config" className="gap-1.5">
            <Building2 className="w-4 h-4" />
            Configuración
          </TabsTrigger>
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

        {/* ===== CONFIGURACIÓN TAB ===== */}
        <TabsContent value="config" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Información de la Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Nombre de la Empresa</Label>
                  <p className="font-medium">FacturaPro</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">RNC</Label>
                  <p className="font-medium">N/A</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Secuencia NCF</Label>
                  <p className="font-medium">B0100000001</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Tasa ITBIS</Label>
                  <p className="font-medium">18%</p>
                </div>
              </div>
              <Separator />
              <p className="text-sm text-muted-foreground">
                La configuración de la empresa se puede modificar editando los valores del sistema.
                Contacte al administrador para realizar cambios.
              </p>
            </CardContent>
          </Card>

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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
