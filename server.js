const express = require('express');
const app = express();
const { resolve } = require('path');
const axios = require('axios');
require('dotenv').config({ path: './.env' });

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: {
    name: "FestivalTicketCheckout",
    version: "1.0.0",
    url: "https://festival-checkout.onrender.com"
  }
});

app.use(express.static("./client"));
app.use(express.urlencoded({ extended: true }));
app.use(
  express.json({
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);

// Checkout session creation
app.post('/create-checkout-session', async (req, res) => {
  const metadata = req.body;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        unit_amount: 500,
        currency: 'gbp',
        product_data: {
          name: 'QR Code Generation',
          description: 'Leave this as-is to generate your custom festival tickets.',
        }
      },
      quantity: 1,
    }],
    metadata: metadata,
    success_url: 'https://festival-checkout.onrender.com/success.html',
    cancel_url: 'https://festival-checkout.onrender.com'
  });

  return res.redirect(303, session.url);
});

// Webhook to send data to Google Apps Script after successful payment
app.post('/webhook', async (req, res) => {
  let event;

  if (process.env.STRIPE_WEBHOOK_SECRET) {
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
  } else {
    event = req.body;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata || {};

    try {
      await axios.post(process.env.GOOGLE_SCRIPT_URL, metadata);
      console.log("✅ Data sent to Google Apps Script");
    } catch (err) {
      console.error("❌ Failed to send to Google Apps Script:", err.message);
    }
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log(`Node server listening on port 3000!`));
