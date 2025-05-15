const express = require('express');
const cors = require('cors');
const app = express();
const { resolve } = require('path');
require('dotenv').config({ path: './.env' });
const fetch = require('node-fetch');

app.use(cors());
app.use(express.static("./client"));
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    verify: function(req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: {
    name: "FestivalTicketCheckout",
    version: "1.0.0",
  }
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const metadata = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          unit_amount: 0,
          currency: 'gbp',
          product_data: {
            name: 'QR Code Generation',
            description: 'Leave this as-is to generate your custom festival tickets.',
          }
        },
        quantity: 1,
      }],
      metadata,
      customer_email: metadata.email,
      success_url: `${process.env.DOMAIN}`,
      cancel_url: `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/canceled.html`
    });

    return res.redirect(303, session.url);
  } catch (err) {
    console.error("❌ Stripe session error:", err.message);
    return res.status(500).json({ error: 'Stripe session creation failed' });
  }
});

app.listen(3000, () => console.log(`Node server listening on port 3000!`));
