import { Request, Response, NextFunction } from 'express';

interface AuthedRequest extends Request {
  user?: { id: string; role?: string };
}

/**
 * À chaîner après verifyAdminSupabase (qui attache req.user).
 * Restreint une route aux comptes role === 'super_admin' — un 'admin' simple
 * est refusé même si verifyAdminSupabase l'a déjà laissé passer.
 */
export function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ success: false, message: 'Accès réservé au super administrateur' });
    return;
  }
  next();
}

export default requireSuperAdmin;
