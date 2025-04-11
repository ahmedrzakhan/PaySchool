const { ValidationError } = require('joi');
const { CONSTANTS } = require('../configs/constants');

class ErrorSerializer {
  static forClient(err) {
    const baseResponse = {
      success: false,
      error: true,
      data: null,
    };

    // For Joi validation errors
    if (err instanceof ValidationError || err.name === 'ValidationError') {
      return {
        ...baseResponse,
        status: 400,
        errorMessage: 'Validation Error',
        details: Array.isArray(err.details)
          ? err.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
            }))
          : [{ message: err.message }],
      };
    }

    // For operational errors (custom AppError instances)
    if (err.isOperational) {
      return {
        ...baseResponse,
        status: err.statusCode,
        errorMessage: err.publicMessage || err.message,
        code: err.clientErrorCode,
      };
    }

    // For all other errors
    return {
      ...baseResponse,
      status: err.status || 500,
      errorMessage:
        process.env.NODE_ENV === CONSTANTS.Environments.PRODUCTION
          ? 'Internal Server Error'
          : err.message,
    };
  }
}

const defaultErrorHandler = (err, req, res, next) => {
  // Ensure response hasn't been sent yet
  if (res.headersSent) {
    return next(err);
  }

  // Set response headers
  res.setHeader('Content-Type', 'application/json');

  // Serialize error for client response
  const clientResponse = ErrorSerializer.forClient(err);

  // Send response
  return res.status(clientResponse.status).json(clientResponse);
};
const ErrorHandler = {
  defaultErrorHandler,
};

module.exports = {
  ErrorHandler,
};
