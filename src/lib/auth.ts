import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'pos-system-secret-key-2024-secure-default-zlrm'

// Generate a unique server instance ID on startup.
// When the server restarts, this ID changes, making all existing tokens invalid.
const SERVER_INSTANCE_ID = randomUUID()

/**
 * Get the current server instance ID (useful for debugging)
 */
export function getServerInstanceId(): string {
  return SERVER_INSTANCE_ID
}

export interface TokenPayload {
  userId: string
  username: string
  role: string
  sid: string       // server instance ID - invalidates tokens on server restart
  loginDate: string // YYYY-MM-DD - invalidates tokens at midnight
}

/**
 * Hash a password using bcryptjs with salt rounds 10
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * Compare a plain password against a bcrypt hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Get today's date in YYYY-MM-DD format (local timezone)
 */
function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Sign a JWT token with user payload, server instance ID, and login date
 */
export function signToken(payload: Omit<TokenPayload, 'sid' | 'loginDate'>): string {
  const fullPayload: TokenPayload = {
    ...payload,
    sid: SERVER_INSTANCE_ID,
    loginDate: getTodayDate(),
  }
  // Token expires in 24h but also checked against midnight
  return jwt.sign(fullPayload, JWT_SECRET, { expiresIn: '24h' })
}

/**
 * Verify a JWT token and return the payload or null if invalid.
 * Checks:
 * 1. Token signature is valid and not expired (JWT native)
 * 2. Server instance ID matches (invalidates on server restart)
 * 3. Login date matches today (invalidates at midnight)
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload

    // Check 1: Server instance ID must match (server restart detection)
    if (decoded.sid !== SERVER_INSTANCE_ID) {
      return null
    }

    // Check 2: Login date must be today (midnight expiry)
    const today = getTodayDate()
    if (decoded.loginDate !== today) {
      return null
    }

    return decoded
  } catch {
    return null
  }
}

/**
 * Extract and verify user from Authorization Bearer header in a Request
 */
export function getUserFromRequest(request: Request): TokenPayload | null {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    return verifyToken(token)
  } catch {
    return null
  }
}
