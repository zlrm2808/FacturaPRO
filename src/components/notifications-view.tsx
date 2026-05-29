'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Bell,
  BellOff,
  CheckCheck,
  FileText,
  DollarSign,
  Key,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'

type NotificationType = 'FACTURA_VENCIDA' | 'PAGO_PENDIENTE' | 'LICENCIA_VENCER' | 'INVENTARIO_BAJO'

const NOTIFICATION_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bgColor: string }> = {
  FACTURA_VENCIDA: {
    icon: FileText,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  PAGO_PENDIENTE: {
    icon: DollarSign,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  LICENCIA_VENCER: {
    icon: Key,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  INVENTARIO_BAJO: {
    icon: Package,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
}

export function NotificationsView() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
  })

  const notifications = (data?.notifications || []) as Record<string, unknown>[]
  const unreadCount = (data?.unreadCount || 0) as number

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.put('/notifications', { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.put('/notifications', { markAll: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Todas las notificaciones marcadas como leídas')
    },
  })

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate(id)
  }

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate()
  }

  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications

  const getNotificationConfig = (type: string) => {
    return NOTIFICATION_CONFIG[type as NotificationType] || {
      icon: Bell,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Ahora mismo'
    if (diffMins < 60) return `Hace ${diffMins} min`
    if (diffHours < 24) return `Hace ${diffHours}h`
    if (diffDays < 7) return `Hace ${diffDays}d`
    return formatDateTime(dateStr)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notificaciones
          </h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? `Tienes ${unreadCount} notificación${unreadCount !== 1 ? 'es' : ''} sin leer`
              : 'No tienes notificaciones sin leer'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <Bell className="w-4 h-4" />
            Todas
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                {notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="gap-1.5">
            <BellOff className="w-4 h-4" />
            No leídas
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notification List */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {filter === 'unread'
                ? 'No tienes notificaciones sin leer'
                : 'No hay notificaciones'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const config = getNotificationConfig(notification.type as string)
              const IconComponent = config.icon
              const isRead = notification.read as boolean

              return (
                <Card
                  key={notification.id as string}
                  className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                    !isRead ? 'border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                  }`}
                  onClick={() => {
                    if (!isRead) {
                      handleMarkAsRead(notification.id as string)
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${config.bgColor}`}>
                        <IconComponent className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-sm font-medium ${!isRead ? 'font-semibold' : ''}`}>
                              {notification.title as string}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {notification.message as string}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTimeAgo(notification.createdAt as string)}
                            </span>
                            {!isRead && (
                              <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
