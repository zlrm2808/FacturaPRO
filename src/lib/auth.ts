import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'pos-system-secret-key-2024-secure-default-zlrm'
const TOKEN_EXPIRY = '24h'

export interface TokenPayload {
  userId: string
  username: string
  role: string
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
 * Sign a JWT token with user payload
 */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })
}

/**
 * Verify a JWT token and return the payload or null if invalid
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload
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
