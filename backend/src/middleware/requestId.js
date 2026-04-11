import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.set('X-Request-Id', req.id);
  next();
};
