import pool from '../config/db.js';

export const createDelivery = async (req, res) => {
  try {
    const { userId, pickup, delivery, method } = req.body;

    const result = await pool.query(
      'INSERT INTO deliveries(user_id, pickup, delivery, method, status) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [userId, pickup, delivery, method, 'pending']
    );

    // Émettre un événement Socket.io aux livreurs connectés
    const io = req.app.get('io');
    io.emit('new_delivery', result.rows[0]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getUserDeliveries = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query('SELECT * FROM deliveries WHERE user_id=$1', [userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
