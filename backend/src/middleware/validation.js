import Joi from 'joi';
import logger from '../utils/logger.js';
import { sendError } from '../utils/apiResponse.js';

export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const details = error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message.replace(/"/g, ''),
        }));
        
        logger.warn('Validation failed:', { details });
        const errorMessage = details.map(d => `${d.field}: ${d.message}`).join('; ');
        return sendError(res, 400, `Validation failed: ${errorMessage}`, { details });
      }

      // Replace body with validated data
      req.body = value;
      next();
    } catch (err) {
      logger.error('Validation middleware error:', err);
      return sendError(res, 500, 'Validation failed');
    }
  };
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
      });

      if (error) {
        const details = error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        }));

        return sendError(res, 400, 'Invalid parameters', { details });
      }

      req.params = value;
      next();
    } catch (err) {
      logger.error('Param validation error:', err);
      return sendError(res, 500, 'Validation failed');
    }
  };
};

export const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
      });

      if (error) {
        const details = error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message,
        }));

        return sendError(res, 400, 'Invalid query parameters', { details });
      }

      req.query = value;
      next();
    } catch (err) {
      logger.error('Query validation error:', err);
      return sendError(res, 500, 'Validation failed');
    }
  };
};
