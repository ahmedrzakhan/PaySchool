const express = require('express');
const router = express.Router();

const { AuthRouter } = require('./auth.routes');
const { UserRouter } = require('./user.routes');
const { PaymentRouter } = require('./payment.routes');

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

router.use('/auth', AuthRouter);
router.use('/user', UserRouter);
router.use('/payment', PaymentRouter);

const routerV1 = router;

module.exports = { routerV1 };
