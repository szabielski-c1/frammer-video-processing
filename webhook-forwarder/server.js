const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Target URL for forwarding webhooks
const FORWARD_URL = 'https://web-production-e4a7d.up.railway.app/api/webhook';

// Middleware
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Webhook Forwarder',
    forwarding_to: FORWARD_URL
  });
});

// Webhook endpoint - receives from Frammer and forwards to frammer app
app.post('/webhook', async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Time:', new Date().toISOString());
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Forwarding to:', FORWARD_URL);

  try {
    // Forward the webhook to the frammer video processing app
    const response = await axios.post(FORWARD_URL, req.body, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('✓ Successfully forwarded to frammer app');
    console.log('Response:', response.status, response.data);
    console.log('========================');

    // Acknowledge receipt to Frammer
    res.status(200).json({
      status: 'forwarded',
      target: FORWARD_URL
    });

  } catch (error) {
    console.error('✗ Error forwarding webhook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    console.log('========================');

    // Still acknowledge to Frammer to prevent retries
    res.status(200).json({
      status: 'error',
      message: error.message,
      note: 'Acknowledged but forward failed'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook Forwarder running on port ${PORT}`);
  console.log(`Receiving webhooks at: /webhook`);
  console.log(`Forwarding to: ${FORWARD_URL}`);
});
