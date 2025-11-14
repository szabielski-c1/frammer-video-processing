require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Store webhook results in memory (in production, use a database)
const webhookResults = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Submit video processing request to Frammer API
app.post('/api/process-video', async (req, res) => {
  try {
    const { videoUrl, language, contentType, outputType } = req.body;

    // Validate required fields
    if (!videoUrl || !language || !contentType || !outputType) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: videoUrl, language, contentType, outputType'
      });
    }

    // Validate API key
    if (!process.env.FRAMMER_API_KEY) {
      return res.status(500).json({
        status: 'error',
        message: 'FRAMMER_API_KEY not configured'
      });
    }

    // Make request to Frammer API
    const framerResponse = await axios.post(
      'https://demo.frammer.com/api/api_process_video',
      {
        videoUrl,
        language,
        contentType,
        outputType
      },
      {
        headers: {
          'Authorization': process.env.FRAMMER_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    // Store the request ID for webhook tracking
    if (framerResponse.data.data && framerResponse.data.data.id) {
      webhookResults.set(framerResponse.data.data.id, {
        status: 'pending',
        timestamp: new Date().toISOString(),
        videoUrl: videoUrl,
        language: language,
        contentType: contentType,
        outputType: outputType,
        initialResponse: framerResponse.data
      });
    }

    res.json({
      status: 'success',
      data: framerResponse.data
    });

  } catch (error) {
    console.error('Error processing video:', error.response?.data || error.message);

    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data?.message || error.message,
      details: error.response?.data || null
    });
  }
});

// Webhook endpoint to receive Frammer API results
app.post('/api/webhook', (req, res) => {
  try {
    const webhookData = req.body;
    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

    // Extract the ID from the webhook data
    if (webhookData.data && webhookData.data.id) {
      const id = webhookData.data.id;

      // Get existing data or create new entry
      const existing = webhookResults.get(id) || {
        status: 'received',
        timestamp: new Date().toISOString()
      };

      // Update with new webhook data
      existing.lastWebhook = {
        event: webhookData.event,
        data: webhookData.data,
        timestamp: new Date().toISOString()
      };

      // Update status based on event
      if (webhookData.event === 'video_processed.inqueue') {
        existing.status = 'in_queue';
      } else if (webhookData.event === 'video_processed.partial-success') {
        existing.status = 'processing';
      } else if (webhookData.event === 'video_processed.success') {
        existing.status = 'completed';
      }

      webhookResults.set(id, existing);
    }

    // Acknowledge receipt
    res.status(200).json({ status: 'received' });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get webhook results for a specific ID
app.get('/api/results/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const result = webhookResults.get(id);

  if (!result) {
    return res.status(404).json({
      status: 'error',
      message: 'No results found for this ID'
    });
  }

  res.json({
    status: 'success',
    data: result
  });
});

// Get all webhook results
app.get('/api/results', (req, res) => {
  const allResults = Array.from(webhookResults.entries()).map(([id, data]) => ({
    id,
    ...data
  }));

  res.json({
    status: 'success',
    count: allResults.length,
    data: allResults
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local Webhook URL: http://localhost:${PORT}/api/webhook`);
  console.log(`Configured External Webhook URL: ${process.env.WEBHOOK_URL || 'Not set'}`);
  console.log(`\nNote: Configure the webhook URL in your Frammer dashboard to receive results.`);
});
