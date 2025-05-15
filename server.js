const express = require('express');
const cors = require('cors');
const app = express();
const { resolve } = require('path');
require('dotenv').config({ path: './.env' });
const fetch = require('node-fetch');

// Manual CORS config to be extra explicit
const allowedOrigin = 'https://spectacular-tartufo-bceeb8.netlify.app';
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
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

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2020-08-27',
  appInfo: {
    name: "FestivalTicketCheckout",
    version: "1.0.0",
    url: "https://replit.com/@PagansWitches26/Festival-Ticket-Checkout"
  }
});

const baseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

app.get('/', (req, res) => {
  const path = resolve('./client/index.html');
  res.sendFile(path);
});

app.post('/create-checkout-session', async (req, res) => {
  const metadata = req.body;

  try {
    const prices = {
      "3DayTicket": 4000,
      "AdultSaturdayTicket": 1500,
      "AdultSundayTicket": 1500,
      "AdultMondayTicket": 1500,
      "ChildSaturdayTicket": 500,
      "ChildSundayTicket": 500,
      "ChildMondayTicket": 500,
      "Disabled3DayTicket": 4000,
      "DisabledSaturdayTicket": 1500,
      "DisabledSundayTicket": 1500,
      "DisabledMondayTicket": 1500
    };

    let total = 0;
    for (let key in prices) {
      const quantity = parseInt(metadata[key] || '0');
      total += prices[key] * quantity;
    }

    if (total === 0) {
      return res.status(400).json({ error: "Total amount cannot be zero." });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          unit_amount: total,
          currency: 'gbp',
          product_data: {
            name: 'Festival Tickets',
            description: 'Festival entry tickets'
          }
        },
        quantity: 1
      }],
      metadata: metadata,
      customer_email: metadata.email,
      success_url: process.env.DOMAIN,
      cancel_url: `${baseUrl}/canceled.html`
    });

    return res.status(200).json({ url: session.url }); // Return JSON instead of redirect
  } catch (error) {
    console.error("❌ Stripe session creation failed:", error.message);
    return res.status(500).json({ error: 'Stripe session creation failed.' });
  }
});

app.post('/webhook', async (req, res) => {
  let event;

  if (process.env.STRIPE_WEBHOOK_SECRET) {
    const signature = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.log(`⚠️ Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
  } else {
    event = req.body;
  }

  if (event.type === 'checkout.session.completed') {
    console.log("🔔 Payment received!");

    const session = event.data.object;

    const name = session.metadata?.name || 'Unknown';
    const email = session.customer_details?.email || 'no-email@example.com';
    const phone = session.metadata?.phone || '';
    const address = session.metadata?.address || '';
    const ticketTypes = {
      "3DayTicket": session.metadata?.["3DayTicket"] || 0,
      "AdultSaturdayTicket": session.metadata?.["AdultSaturdayTicket"] || 0,
      "AdultSundayTicket": session.metadata?.["AdultSundayTicket"] || 0,
      "AdultMondayTicket": session.metadata?.["AdultMondayTicket"] || 0,
      "ChildSaturdayTicket": session.metadata?.["ChildSaturdayTicket"] || 0,
      "ChildSundayTicket": session.metadata?.["ChildSundayTicket"] || 0,
      "ChildMondayTicket": session.metadata?.["ChildMondayTicket"] || 0,
      "Disabled3DayTicket": session.metadata?.["Disabled3DayTicket"] || 0,
      "DisabledSaturdayTicket": session.metadata?.["DisabledSaturdayTicket"] || 0,
      "DisabledSundayTicket": session.metadata?.["DisabledSundayTicket"] || 0,
      "DisabledMondayTicket": session.metadata?.["DisabledMondayTicket"] || 0
    };

    const queryParams = new URLSearchParams({
      name,
      email,
      phone,
      address,
      ...ticketTypes
    }).toString();

    const appsScriptURL = `https://script.google.com/macros/s/AKfycbylCZoxye71c5LAp-tGoiycMhBSxQGQr0a2enGwPFdiokO4DdsGmBGbhrmOTEIB-Q-E/exec?${queryParams}`;

    try {
      await fetch(appsScriptURL);
      console.log("✅ Logged to Google Sheet");
    } catch (error) {
      console.error("❌ Failed to log to Google Sheet:", error.message);
    }
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log(`Node server listening on port 3000!`));
