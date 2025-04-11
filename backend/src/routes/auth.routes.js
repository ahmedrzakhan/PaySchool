const passport = require('passport');
const jwt = require('jsonwebtoken');
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
// Google Auth Routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login',
  }),
  async (req, res) => {
    try {
      // Check if the user already has a Stripe customer ID
      let user = req.user;
      if (!user.stripeCustomerId) {
        // Create a Stripe customer
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.displayName,
        });

        // Update the user with the Stripe customer ID
        user.stripeCustomerId = customer.id;
        await user.save();
      }
      // Generate JWT token
      const token = jwt.sign(
        { id: req.user._id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Redirect or send token (for Postman testing, we'll send the token)
      // res.json({ token, user: req.user });
      const userData = encodeURIComponent(JSON.stringify(req.user));
      res.redirect(
        `http://localhost:3000/callback?token=${token}&user=${userData}`
      );
    } catch (err) {
      console.error('Error in Google callback:', err);
      res.status(500).json({
        success: false,
        error: true,
        data: null,
        status: 500,
        errorMessage: err.message,
      });
    }
  }
);

router.post('/logout', (req, res) => {
  // In a stateless JWT setup, logout is handled client-side by removing the token
  res.json({ message: 'Logged out successfully' });
});

const AuthRouter = router;

module.exports = { AuthRouter };
