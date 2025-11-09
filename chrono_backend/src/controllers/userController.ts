import { Request, Response } from 'express';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export const registerUser = async (req: Request<{}, {}, RegisterBody>, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const existing = await pool.query('SELECT * FROM users WHERE email=$1', [email]) as any;
    if (existing.rows && existing.rows.length > 0) {
      res.status(400).json({ message: 'Email déjà utilisé' });
      return;
    }

    const result = await pool.query(
      'INSERT INTO users(name, email, password) VALUES($1,$2,$3) RETURNING id, name, email',
      [name, email, hashed]
    ) as any;

    res.json(result.rows[0]);
  } catch (error: any) {
    logger.error('❌ Erreur registerUser:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const loginUser = async (req: Request<{}, {}, LoginBody>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]) as any;

    if (!result.rows || result.rows.length === 0) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    const valid = await bcrypt.compare(password, result.rows[0].password);
    if (!valid) {
      res.status(401).json({ message: 'Mot de passe incorrect' });
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      logger.error('❌ JWT_SECRET non configuré');
      res.status(500).json({ message: 'Erreur de configuration serveur' });
      return;
    }

    const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ user: result.rows[0], token });
  } catch (error: any) {
    logger.error('❌ Erreur loginUser:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

