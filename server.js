const express = require('express');
const app = express();
const { resolve } = require('path');
require('dotenv').config({ path: './.env' });
const fetch = require('node-fetch');

const baseUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

const stripe = require('stripe')('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', {
  apiVersion: '2020-08-27',
  appInfo: {
    name: "FestivalTicketCheckout",
    version: "1.0.0",
    url: "https://replit.com/@PagansWitches26/Festival-Ticket-Checkout"
  }
});

app.use(express.static("./client"));
app.use(express.urlencoded());
app.use(
  express.json({
    verify: function(req, res, buf) {
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
  const metadata = req.body; // grab all form data as metadata

  console.log("Metadata received at checkout:", metadata);

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
    success_url: `${process.env.DOMAIN}`,
    cancel_url: `${baseUrl}/canceled.html`
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

    const session = event.data.object;

    console.log("Webhook session object:", session);

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
      console.error("❌ Failed to log to Google Sheet:", error);
    }
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log(`Node server listening on port 3000!`));
