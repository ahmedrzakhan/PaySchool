const express = require('express');
const router = express.Router();
const { AuthMiddleware } = require('./../middlewares/auth.middleware');
const User = require('./../models/User');

router.get('/profile', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

const UserRouter = router;

module.exports = { UserRouter };
