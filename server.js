app.post('/create-checkout-session', async (req, res) => {
  const metadata = req.body;

  console.log("Metadata received at checkout:", metadata);

  // Prices in pence (GBP)
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

  let totalAmount = 0;

  for (let key in prices) {
    const quantity = parseInt(metadata[key]) || 0;
    totalAmount += prices[key] * quantity;
  }

  if (totalAmount === 0) {
    console.error("Stripe session error: Cannot create a £0 checkout session.");
    return res.status(400).json({ error: 'Amount must be greater than zero' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: totalAmount,
          product_data: {
            name: 'Festival Ticket Purchase',
            description: 'Includes all selected ticket types',
          }
        },
        quantity: 1
      }],
      metadata,
      customer_email: metadata.email,
      success_url: `${process.env.DOMAIN}`,
      cancel_url: `${baseUrl}/canceled.html`
    });

    return res.redirect(303, session.url);
  } catch (error) {
    console.error("❌ Error creating checkout session:", error);
    return res.status(500).json({ error: 'Stripe session creation failed' });
  }
});
