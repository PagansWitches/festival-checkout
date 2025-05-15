const express = require('express');
const cors = require('cors');
const app = express();
const { resolve } = require('path');
require('dotenv').config({ path: './.env' });
const fetch = require('node-fetch');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: {
    name: "FestivalTicketCheckout",
    version: "1.0.0",
    url: "https://replit.com/@PagansWitches26/Festival-Ticket-Checkout"
  }
});

app.use(cors());
app.use(express.static("./client"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({
  verify: function (req, res, buf) {
    if (req.originalUrl.startsWith('/webhook')) {
      req.rawBody = buf.toString();
    }
  }
}));

app.get('/', (req, res) => {
  const path = resolve('./client/index.html');
  res.sendFile(path);
});

app.get('/checkout-session', async (req, res) => {
  const { sessionId } = req.query;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    res.send(session);
  } catch (error) {
    console.error("Error retrieving session:", error.message);
    res.status(400).send("Session retrieval failed.");
  }
});

app.post('/create-checkout-session', async (req, res) => {
  const metadata = req.body;
  console.log("Metadata received:", metadata);

  try {
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
      metadata: metadata,
      customer_email: metadata.email,
      success_url: process.env.DOMAIN,
      cancel_url: process.env.CANCEL_URL || 'https://festival-checkout.onrender.com/canceled.html',
    });

    console.log("Stripe session created:", session.id);
    return res.redirect(303, session.url);
  } catch (error) {
    console.error("❌ Failed to create checkout session:", error);
    return res.status(500).json({ error: 'Stripe session creation failed.' });
  }
});

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
      console.log(`⚠️  Webhook signature verification failed.`, err.message);
      return res.sendStatus(400);
    }
  } else {
    event = req.body;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log("✅ Payment received session:", session.id);

    const name = session.metadata?.name || 'Unknown';
    const email = session.customer_details?.email || 'no-email@example.com';
    const phone = session.metadata?.phone || '';
    const address = session.metadata?.address || '';

    const ticketTypes = [
      "3DayTicket", "AdultSaturdayTicket", "AdultSundayTicket", "AdultMondayTicket",
      "ChildSaturdayTicket", "ChildSundayTicket", "ChildMondayTicket",
      "Disabled3DayTicket", "DisabledSaturdayTicket", "DisabledSundayTicket", "DisabledMondayTicket"
    ];

    const ticketData = {};
    ticketTypes.forEach(type => {
      ticketData[type] = session.metadata?.[type] || 0;
    });

    const queryParams = new URLSearchParams({
      name,
      email,
      phone,
      address,
      ...ticketData
    }).toString();

    const appsScriptURL = `https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec?${queryParams}`;

    try {
      await fetch(appsScriptURL);
      console.log("✅ Logged to Google Sheet");
    } catch (error) {
      console.error("❌ Logging to Google Sheet failed:", error.message);
    }
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log(`Node server listening on port 3000!`));
