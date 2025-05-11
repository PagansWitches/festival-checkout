const express = require('express');
const app = express();
const { resolve } = require('path');
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
app.use(express.urlencoded());
app.use(
  express.json({
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);

app.get('/', (req, res) => {
  const path = resolve('./client/index.html');
  res.sendFile(path);
});

app.get('/checkout-session', async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        unit_amount: 500, // £5.00 in pence
        currency: 'gbp',
        product_data: {
          name: 'QR Code Generation',
          description: 'Leave this as-is to generate your custom festival tickets.',
        }
      },
      quantity: 1,
    }],
    success_url: `${process.env.DOMAIN}`,
    cancel_url: `${process.env.DOMAIN}`
  });

  return res.redirect(303, session.url);
});

app.post('/webhook', async (req, res) => {
  let event;

  if (process.env.STRIPE_WEBHOOK_SECRET) {
    const signature = req.headers['stripe-signature'];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
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
    console.log(`🔔  Payment received!`);
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log(`Node server listening on port 3000!`));
