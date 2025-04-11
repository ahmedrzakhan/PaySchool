const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const mongoSanitize = require('express-mongo-sanitize');
const jwt = require('jsonwebtoken');
const passport = require('passport');
require('./configs/auth/passport');
const bunyan = require('bunyan');
const dotenv = require('dotenv');

const { CONFIG } = require('./configs/config');
const { routerV1 } = require('./routes/index');
const { Interceptor } = require('./middlewares/responseInterceptor');
const { ErrorHandler } = require('./middlewares/errorHandler');

const logger = require('./configs/logger');

dotenv.config();

const app = express();

const log = bunyan.createLogger({ name: 'payschool-be-platform' });

app.use(
  helmet({
    frameguard: {
      action: 'deny', // Completely prevent framing
    },
  })
);

app.use(cors()); // Enable CORS

app.use(
  mongoSanitize({
    replaceWith: '_', // Replace prohibited characters with this
    onSanitize: ({ req, key }) => {
      log.warn(`Attempted NoSQL injection detected: ${key}`); // Log sanitization attempts
    },
  })
);
app.use(express.json()); // Parse JSON bodies
app.use(passport.initialize()); // Initialize Passport for authentication

app.use(logger.requestIdMiddleware());
app.use(logger.requestLogger());
app.use(Interceptor.responseInterceptor);

app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS_ERROR',
      message: 'Origin not allowed',
    });
  }
  next(err);
});

// API Routes

// Google Auth Routes
// app.get(
//   '/auth/google',
//   passport.authenticate('google', { scope: ['profile', 'email'] })
// );

// app.get(
//   '/auth/google/callback',
//   passport.authenticate('google', {
//     session: false,
//     failureRedirect: '/login',
//   }),
//   (req, res) => {
//     // Generate JWT token
//     const token = jwt.sign(
//       { id: req.user._id, email: req.user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '1h' }
//     );

//     // Redirect or send token (for Postman testing, we'll send the token)
//     res.json({ token, user: req.user });
//   }
// );

// Protected Route Example
// app.get('/profile', authenticateToken, async (req, res) => {
//   try {
//     const user = await User.findById(req.user.id);
//     res.json(user);
//   } catch (err) {
//     res.status(500).json({ message: 'Server error' });
//   }
// });

// Logout Route (Client should remove the token)
app.post('/logout', (req, res) => {
  // In a stateless JWT setup, logout is handled client-side by removing the token
  res.json({ message: 'Logged out successfully' });
});

// Middleware to authenticate JWT
// function authenticateToken(req, res, next) {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

//   if (!token) {
//     return res.status(401).json({ message: 'Authentication token required' });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (err) {
//     res.status(403).json({ message: 'Invalid or expired token' });
//   }
// }

app.use('/api/v1', routerV1);

// 404 Handler (after routes but before error handlers)
app.use((req, res) => {
  res.status(404).json({ message: 'Resource not found' });
});

// Error handling middleware (always at the end, but before server start)
app.use(ErrorHandler.defaultErrorHandler);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    success: false,
    error: true,
    data: null,
    errorMessage: 'Something went wrong',
  });
});

const connectMongo = async (retryCount = 0) => {
  const maxRetries = 3;

  try {
    await mongoose.connect(CONFIG.MONGO_URI, {});

    logger.info(
      'MongoDB connected successfully',
      'MONGODB_CONNECTED_SUCCESSFULLY',
      'MONGODB_CONNECTED_SUCCESSFULLY'
    );
  } catch (error) {
    logger.error(
      `MongoDB connection attempt ${retryCount + 1} failed`,
      'MONGODB_CONNECTION_ERROR',
      'MONGODB_CONNECTION_ERROR',
      error
    );

    if (retryCount < maxRetries) {
      return connectMongo(retryCount + 1);
    }

    throw new Error('All MongoDB connection attempts failed');
  }
};

const connectDatabases = async () => {
  try {
    await Promise.all([connectMongo()]);
    log.info('All database connections established');
  } catch (err) {
    log.error('Failed to connect to databases', err);
    process.exit(1); // Crash and let container/process manager handle restart
  }
};

connectDatabases();

// Start the server
app.listen(CONFIG.PORT, () => {
  console.log(`Server running on port ${CONFIG.PORT}`);
});
