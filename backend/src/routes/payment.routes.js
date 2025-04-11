const express = require('express');
const router = express.Router();
const { AuthMiddleware } = require('./../middlewares/auth.middleware');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const User = require('./../models/User');

// router.post(
//   '/stripe/setup-intent',
//   AuthMiddleware.authenticateToken,
//   async (req, res) => {
//     try {
//       const user = await User.findById(req.user.id);
//       if (!user.stripeCustomerId) {
//         return res
//           .status(400)
//           .json({ message: 'Stripe customer ID not found' });
//       }

//       const setupIntent = await stripe.setupIntents.create({
//         customer: user.stripeCustomerId,
//         payment_method_types: ['card'],
//       });

//       res.json({ clientSecret: setupIntent.client_secret });
//     } catch (err) {
//       res
//         .status(500)
//         .json({ message: 'Error creating Setup Intent', error: err.message });
//     }
//   }
// );

// src/server.js
router.post(
  '/stripe/setup-intent',
  AuthMiddleware.authenticateToken,
  async (req, res) => {
    try {
      console.log('User ID from token:', req.user.id);
      const user = await User.findById(req.user.id);
      console.log('User:', user);
      if (!user) {
        console.log('User not found for ID:', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }

      let stripeCustomerId = user.stripeCustomerId;

      // Check if the customer exists in Stripe
      if (stripeCustomerId) {
        try {
          await stripe.customers.retrieve(stripeCustomerId);
        } catch (err) {
          if (
            err.code === 'resource_missing' &&
            err.message.includes('No such customer')
          ) {
            console.log(
              'Customer not found in Stripe, creating a new one:',
              stripeCustomerId
            );
            // Customer doesn't exist, create a new one
            const newCustomer = await stripe.customers.create({
              email: user.email,
              name: user.displayName,
            });
            stripeCustomerId = newCustomer.id;
            // Update the user's stripeCustomerId in the database
            user.stripeCustomerId = stripeCustomerId;
            await user.save();
            console.log('New customer created and saved:', stripeCustomerId);
          } else {
            throw err; // Rethrow other errors
          }
        }
      } else {
        // No stripeCustomerId, create a new customer
        const newCustomer = await stripe.customers.create({
          email: user.email,
          name: user.displayName,
        });
        stripeCustomerId = newCustomer.id;
        user.stripeCustomerId = stripeCustomerId;
        await user.save();
        console.log('New customer created and saved:', stripeCustomerId);
      }

      console.log('Creating Setup Intent for customer:', stripeCustomerId);
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
      });

      console.log('Setup Intent created:', setupIntent);
      res.json({ clientSecret: setupIntent.client_secret });
    } catch (err) {
      console.error('Error in /stripe/setup-intent:', err);
      res
        .status(500)
        .json({ message: 'Error creating Setup Intent', error: err.message });
    }
  }
);

router.post(
  '/stripe/create-invoice',
  AuthMiddleware.authenticateToken,
  async (req, res) => {
    try {
      console.log('User ID from token:', req.user.id);
      const user = await User.findById(req.user.id);
      console.log('User:', user);
      if (!user) {
        console.log('User not found for ID:', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.stripeCustomerId) {
        console.log('No Stripe customer ID found for user:', user.email);
        return res
          .status(400)
          .json({
            message:
              'No Stripe customer ID found. Please add a payment method first.',
          });
      }

      // Verify the customer exists in Stripe
      let stripeCustomer;
      try {
        stripeCustomer = await stripe.customers.retrieve(user.stripeCustomerId);
        console.log('Customer exists in Stripe:', stripeCustomer.id);
      } catch (err) {
        console.log('Error retrieving customer:', err);
        if (
          err.type === 'StripeInvalidRequestError' &&
          err.message.includes('No such customer')
        ) {
          console.log(
            'Customer not found in Stripe, creating a new one:',
            user.stripeCustomerId
          );
          stripeCustomer = await stripe.customers.create({
            email: user.email,
            name: user.displayName,
          });
          user.stripeCustomerId = stripeCustomer.id;
          await user.save();
          console.log('New customer created and saved:', stripeCustomer.id);
        } else {
          console.error('Unexpected error when retrieving customer:', err);
          throw err;
        }
      }

      // Check if the customer has a default payment method
      if (!stripeCustomer.invoice_settings.default_payment_method) {
        console.log(
          'No default payment method found for customer:',
          stripeCustomer.id
        );
        return res
          .status(400)
          .json({
            message:
              'No default payment method found. Please add a payment method.',
          });
      }

      // Create an invoice item (e.g., $10.00 for a test invoice)
      const invoiceItem = await stripe.invoiceItems.create({
        customer: stripeCustomer.id,
        amount: 1000, // $10.00 (in cents)
        currency: 'usd',
        description: 'Test Invoice - Payment for Services',
      });
      console.log('Invoice item created:', invoiceItem.id);

      // Create the invoice
      const invoice = await stripe.invoices.create({
        customer: stripeCustomer.id,
        collection_method: 'charge_automatically',
        auto_advance: true,
      });
      console.log('Invoice created:', invoice.id);

      // Finalize the invoice
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id,
        {
          auto_advance: true,
        }
      );
      console.log(
        'Invoice finalized:',
        finalizedInvoice.id,
        'Status:',
        finalizedInvoice.status
      );

      // Check if the invoice is already paid; if not, attempt to pay it
      let paidInvoice = finalizedInvoice;
      if (finalizedInvoice.status !== 'paid') {
        console.log('Invoice not paid, attempting to pay now');
        paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
        console.log(
          'Invoice payment attempted:',
          paidInvoice.id,
          'Status:',
          paidInvoice.status
        );
      } else {
        console.log('Invoice already paid, skipping payment attempt');
      }

      res.json({
        invoiceId: paidInvoice.id,
        invoiceUrl: paidInvoice.hosted_invoice_url,
        status: paidInvoice.status,
      });
    } catch (err) {
      console.error('Error in /stripe/create-invoice:', err);
      res
        .status(500)
        .json({ message: 'Error creating invoice', error: err.message });
    }
  }
);

router.post(
  '/stripe/set-default-payment-method',
  AuthMiddleware.authenticateToken,
  async (req, res) => {
    try {
      const { paymentMethodId } = req.body; // The payment method ID from the Setup Intent
      console.log(
        'Setting default payment method, paymentMethodId:',
        paymentMethodId
      );

      // Find the user
      const user = await User.findById(req.user.id);
      console.log('User:', user);
      if (!user) {
        console.log('User not found for ID:', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.stripeCustomerId) {
        console.log('No Stripe customer ID found for user:', user.email);
        return res
          .status(400)
          .json({ message: 'No Stripe customer ID found.' });
      }

      // Verify the customer exists in Stripe
      let stripeCustomer;
      try {
        stripeCustomer = await stripe.customers.retrieve(user.stripeCustomerId);
        console.log('Customer exists in Stripe:', stripeCustomer.id);
      } catch (err) {
        console.log('Error retrieving customer:', err);
        if (
          err.type === 'StripeInvalidRequestError' &&
          err.message.includes('No such customer')
        ) {
          console.log(
            'Customer not found in Stripe, creating a new one:',
            user.stripeCustomerId
          );
          stripeCustomer = await stripe.customers.create({
            email: user.email,
            name: user.displayName,
          });
          user.stripeCustomerId = stripeCustomer.id;
          await user.save();
          console.log('New customer created and saved:', stripeCustomer.id);
        } else {
          console.error('Unexpected error when retrieving customer:', err);
          throw err;
        }
      }

      // Update the customer to set the payment method as the default for invoices
      const updatedCustomer = await stripe.customers.update(stripeCustomer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      console.log(
        'Default payment method set for customer:',
        updatedCustomer.id
      );

      res.json({ success: true });
    } catch (err) {
      console.error('Error in /stripe/set-default-payment-method:', err);
      res.status(500).json({
        message: 'Error setting default payment method',
        error: err.message,
      });
    }
  }
);

const PaymentRouter = router;

module.exports = { PaymentRouter };
