import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ram_performance_secret_key_2024';

export const signToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
