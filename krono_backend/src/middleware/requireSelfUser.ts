import { Request, Response, NextFunction } from 'express';

interface RequestWithUser extends Request {
  user?: {
    id: string;
  };
}

/**
 * À monter après verifyJWT sur les routes self-service où :paramName (ex. userId)
 * doit correspondre à l'utilisateur authentifié. Centralise la clause de garde IDOR
 * auparavant dupliquée à l'identique dans driverController et commissionController
 * (audit 2026-07-23) — un futur endpoint self-service qui oublie de la monter
 * échouera de façon visible (accès non filtré) plutôt que silencieuse.
 */
export function requireSelfUser(paramName: string = 'userId') {
  return (req: RequestWithUser, res: Response, next: NextFunction): void => {
    const targetId = req.params[paramName];

    if (req.user && req.user.id !== targetId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez accéder qu\'à vos propres données',
      });
      return;
    }

    next();
  };
}

export default requireSelfUser;
