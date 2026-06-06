import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { stat, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const PROJECT_ROOT = process.cwd()

// Allowed file extensions for updates (safety - only source code files)
const ALLOWED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.prisma',
  '.md', '.env', '.env.local', '.env.production',
  '.yaml', '.yml', '.toml', '.html', '.svg',
]

// Directories that should NOT be updated
const BLOCKED_DIRS = [
  'node_modules', '.next', '.git', 'db',
]

function isPathSafe(relativePath: string): boolean {
  // Normalize the path
  const normalized = relativePath.replace(/\\/g, '/')

  // Check for path traversal
  if (normalized.includes('..')) return false

  // Check blocked directories
  for (const dir of BLOCKED_DIRS) {
    if (normalized.startsWith(dir + '/') || normalized === dir) return false
  }

  // Check file extension
  const ext = '.' + normalized.split('.').pop()?.toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false

  return true
}

/**
 * Extract Google Drive folder ID from various URL formats
 */
function extractFolderId(url: string): string | null {
  // Format: https://drive.google.com/drive/folders/FOLDER_ID
  const foldersMatch = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]+)/)
  if (foldersMatch) return foldersMatch[1]

  // Format: https://drive.google.com/open?id=FOLDER_ID
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (openMatch) return openMatch[1]

  // Format: https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
  const sharingMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (sharingMatch) return sharingMatch[1]

  // If it's just a raw ID (alphanumeric, dashes, underscores)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(url.trim())) {
    return url.trim()
  }

  return null
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
  md5Checksum?: string
}

/**
 * List files in a Google Drive folder using the Drive API v3
 */
async function listDriveFiles(folderId: string, apiKey: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,md5Checksum)',
      pageSize: '100',
      key: apiKey,
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })

    if (pageToken) {
      params.set('pageToken', pageToken)
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: { 'Accept': 'application/json' },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = 'Error al acceder a Google Drive'
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error?.message || errorMessage
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()
    if (data.files) {
      allFiles.push(...data.files)
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return allFiles
}

/**
 * Download a file from Google Drive
 */
async function downloadDriveFile(fileId: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`,
    {
      headers: { 'Accept': '*/*' },
    }
  )

  if (!response.ok) {
    throw new Error(`Error al descargar archivo: ${response.statusText}`)
  }

  return await response.text()
}

// GET /api/system/check-updates - Check for updates from Google Drive
export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user || (user.role !== 'DESARROLLADOR' && user.role !== 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderUrl = searchParams.get('folderUrl') || ''
    const apiKey = searchParams.get('apiKey') || ''

    if (!folderUrl) {
      return NextResponse.json({ error: 'URL de carpeta requerida' }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key de Google Drive requerida' }, { status: 400 })
    }

    const folderId = extractFolderId(folderUrl)
    if (!folderId) {
      return NextResponse.json({ error: 'No se pudo extraer el ID de la carpeta de Google Drive' }, { status: 400 })
    }

    // List files in the Drive folder
    const driveFiles = await listDriveFiles(folderId, apiKey)

    // Filter only source code files (not folders or Google Docs)
    const sourceFiles = driveFiles.filter(
      (f) => f.mimeType !== 'application/vnd.google-apps.folder' &&
             f.mimeType !== 'application/vnd.google-apps.document' &&
             f.mimeType !== 'application/vnd.google-apps.spreadsheet' &&
             f.mimeType !== 'application/vnd.google-apps.presentation'
    )

    // Compare with local files
    const updates: {
      name: string
      id: string
      status: 'new' | 'updated' | 'unchanged'
      driveModified: string
      localModified: string | null
      driveSize: number
      path: string
    }[] = []

    for (const file of sourceFiles) {
      // The file name should represent a relative path within the project
      // e.g., "src/components/app-sidebar.tsx" or "prisma/schema.prisma"
      const relativePath = file.name

      if (!isPathSafe(relativePath)) {
        continue // Skip unsafe paths
      }

      const localPath = join(PROJECT_ROOT, relativePath)
      const localExists = existsSync(localPath)

      if (!localExists) {
        // New file
        updates.push({
          name: relativePath,
          id: file.id,
          status: 'new',
          driveModified: file.modifiedTime,
          localModified: null,
          driveSize: parseInt(file.size || '0'),
          path: relativePath,
        })
      } else {
        // Compare modification times
        try {
          const localStat = await stat(localPath)
          const driveModified = new Date(file.modifiedTime)
          const localModified = localStat.mtime

          if (driveModified > localModified) {
            updates.push({
              name: relativePath,
              id: file.id,
              status: 'updated',
              driveModified: file.modifiedTime,
              localModified: localModified.toISOString(),
              driveSize: parseInt(file.size || '0'),
              path: relativePath,
            })
          } else {
            updates.push({
              name: relativePath,
              id: file.id,
              status: 'unchanged',
              driveModified: file.modifiedTime,
              localModified: localModified.toISOString(),
              driveSize: parseInt(file.size || '0'),
              path: relativePath,
            })
          }
        } catch {
          // Can't stat local file, treat as new
          updates.push({
            name: relativePath,
            id: file.id,
            status: 'new',
            driveModified: file.modifiedTime,
            localModified: null,
            driveSize: parseInt(file.size || '0'),
            path: relativePath,
          })
        }
      }
    }

    const availableUpdates = updates.filter((u) => u.status !== 'unchanged')
    const unchanged = updates.filter((u) => u.status === 'unchanged')

    return NextResponse.json({
      folderId,
      totalFiles: sourceFiles.length,
      availableUpdates: availableUpdates.length,
      unchangedFiles: unchanged.length,
      updates: availableUpdates,
      unchanged,
      checkedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error checking updates:', error)
    return NextResponse.json(
      { error: error.message || 'Error al verificar actualizaciones' },
      { status: 500 }
    )
  }
}

// POST /api/system/check-updates - Apply selected updates
export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request)
    if (!user.role || (user.role !== 'DESARROLLADOR' && user.role !== 'ADMINISTRADOR')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { files, apiKey } = body as { files: { id: string; name: string; path: string }[]; apiKey: string }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No se seleccionaron archivos para actualizar' }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key de Google Drive requerida' }, { status: 400 })
    }

    const { writeFile, mkdir } = await import('fs/promises')
    const { dirname } = await import('path')

    const results: { name: string; status: 'success' | 'error'; error?: string }[] = []

    for (const file of files) {
      try {
        // Safety check
        if (!isPathSafe(file.path)) {
          results.push({ name: file.name, status: 'error', error: 'Ruta no permitida' })
          continue
        }

        // Download file content from Drive
        const content = await downloadDriveFile(file.id, apiKey)

        // Ensure the directory exists
        const localPath = join(PROJECT_ROOT, file.path)
        const dir = dirname(localPath)
        await mkdir(dir, { recursive: true })

        // Write the file
        await writeFile(localPath, content, 'utf-8')

        results.push({ name: file.name, status: 'success' })
      } catch (err: any) {
        results.push({ name: file.name, status: 'error', error: err.message || 'Error desconocido' })
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const errorCount = results.filter((r) => r.status === 'error').length

    // Create audit log
    try {
      const { db } = await import('@/lib/db')
      await db.auditLog.create({
        data: {
          action: 'ACTUALIZAR_SISTEMA',
          module: 'SISTEMA',
          details: `Actualización del sistema: ${successCount} archivos actualizados${errorCount > 0 ? `, ${errorCount} errores` : ''}`,
          userId: user.userId,
        },
      })
    } catch {
      // Audit log failure shouldn't block the update
    }

    return NextResponse.json({
      message: `Actualización completada: ${successCount} archivos actualizados${errorCount > 0 ? `, ${errorCount} errores` : ''}`,
      results,
      successCount,
      errorCount,
    })
  } catch (error: any) {
    console.error('Error applying updates:', error)
    return NextResponse.json(
      { error: error.message || 'Error al aplicar actualizaciones' },
      { status: 500 }
    )
  }
}
