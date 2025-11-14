require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Store webhook results in memory (in production, use a database)
const webhookResults = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test webhook endpoint - for debugging
app.post('/api/webhook/test', (req, res) => {
  console.log('Test webhook called!');

  // Simulate a webhook from Frammer
  const testData = {
    event: 'video_processed.partial-success',
    data: {
      id: 999,
      type: 'test',
      insights: [
        {
          video_type: 'vertical video',
          data: [
            {
              video_id: 'test-123',
              video_uri: 'https://example.com/test.mp4',
              status: 'done',
              meta: {}
            }
          ]
        }
      ]
    }
  };

  // Store test data
  webhookResults.set(999, {
    status: 'processing',
    timestamp: new Date().toISOString(),
    videoUrl: 'https://example.com/test-video.mp4',
    lastWebhook: {
      event: testData.event,
      data: testData.data,
      timestamp: new Date().toISOString()
    }
  });

  res.json({ status: 'Test webhook stored', data: testData });
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
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Time:', new Date().toISOString());
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('========================');

    const webhookData = req.body;

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
      console.log(`Updated results for ID ${id}, status: ${existing.status}`);
    } else {
      console.log('WARNING: Webhook data missing ID field');
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

// Proxy endpoint for downloading videos (avoids CORS issues)
app.get('/api/download-video', async (req, res) => {
  try {
    const { url, filename } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('Downloading video:', url);

    // Fetch the video from the source
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    // Set headers for download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || 'video.mp4'}"`);

    // Pipe the video stream to the response
    response.data.pipe(res);

  } catch (error) {
    console.error('Download proxy error:', error.message);
    res.status(500).json({ error: 'Failed to download video', message: error.message });
  }
});

// Catch-all route to serve index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend available at: http://localhost:${PORT}`);
  console.log(`Local Webhook URL: http://localhost:${PORT}/api/webhook`);
  console.log(`Configured External Webhook URL: ${process.env.WEBHOOK_URL || 'Not set'}`);
  console.log(`\nNote: Configure the webhook URL in your Frammer dashboard to receive results.`);
});
