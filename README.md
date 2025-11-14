# Frammer Video Processing Application

A web application for submitting videos to the Frammer AI Video Processing API and viewing processing results.

## Features

- **Frontend Web Interface**: User-friendly form to submit videos for processing
- **Backend API Server**: Node.js/Express server that handles API requests to Frammer
- **Webhook Support**: Receives and displays processing results from Frammer
- **Real-time Updates**: Auto-refreshes results every 10 seconds
- **Multiple Output Types**: Support for full-package, summary, key moments, chapters, and vertical video

## Architecture

```
frammer/
├── backend/
│   ├── server.js          # Express server
│   ├── package.json       # Backend dependencies
│   └── .env              # Environment configuration
└── frontend/
    ├── index.html        # Main HTML page
    ├── style.css         # Styling
    └── script.js         # Frontend JavaScript
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Frammer API key

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. The `.env` file is already configured with:
   - `FRAMMER_API_KEY`: Your Frammer API key
   - `WEBHOOK_URL`: External webhook URL for receiving results
   - `PORT`: Server port (default: 3000)

### Frontend Setup

No build process required! The frontend is pure HTML/CSS/JavaScript.

## Running the Application

### Start the Backend Server

```bash
cd backend
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Open the Frontend

Simply open the `frontend/index.html` file in your web browser:

```bash
open frontend/index.html
```

Or use a simple HTTP server:
```bash
cd frontend
python3 -m http.server 8080
```

Then visit `http://localhost:8080`

## Usage

### Submitting a Video

1. Open the frontend interface
2. Fill in the form:
   - **Video URL**: Public URL to your MP4 video file
   - **Language**: Select the video language (ISO 639-1 code)
   - **Content Type**: Choose from news bulletin, speech, interview, or debate
   - **Output Types**: Select one or more processing options:
     - Full Package: Complete processing with all metadata
     - Summary: Video summary
     - Key Moments: Extract key moments
     - Chapters: Chapter segmentation
     - Vertical Video: Convert 16:9 to 9:16 format
3. Click "Process Video"
4. You'll receive a request ID immediately
5. Results will appear in the right panel as processing completes

### Viewing Results

- Results automatically refresh every 10 seconds
- Click "Refresh Results" to manually update
- Each result card shows:
  - Request ID
  - Processing status (pending, in_queue, processing, completed)
  - Submission timestamp
  - Processing details (when available)
  - Links to generated videos, thumbnails, and metadata

## API Endpoints

### Backend Server

#### POST /api/process-video
Submit a video for processing
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "language": "en",
  "contentType": "news bulletin",
  "outputType": "full-package,summary"
}
```

#### POST /api/webhook
Receives webhook notifications from Frammer (configure this URL in Frammer dashboard)

#### GET /api/results
Get all processing results

#### GET /api/results/:id
Get results for a specific request ID

#### GET /health
Health check endpoint

## Webhook Configuration

The application is configured to receive webhooks at:
```
https://webhook-test.com/1fd043d17d2c144127d8e363cbb1cd53
```

**Important**: You need to configure this webhook URL in your Frammer dashboard so they know where to send processing results.

For local development, you can use tools like:
- [ngrok](https://ngrok.com/) - Expose local server to the internet
- [webhook.site](https://webhook.site/) - Test webhook receiver
- [webhook-test.com](https://webhook-test.com/) - Currently configured

## Webhook Events

The Frammer API sends these webhook events:

1. **video_processed.inqueue**: Video has been queued for processing
2. **video_processed.partial-success**: Processing is in progress with partial results
3. **video_processed.success**: Processing completed successfully

## Output Types Explained

### Standard Processing
- **full-package**: Complete processing with all metadata, titles, descriptions, tags, thumbnails
- **summary**: Condensed version of the video
- **keymoment**: Extract important moments from the video
- **chapters**: Segment video into logical chapters

### Vertical Video
- **vertical video**: Convert horizontal (16:9) video to vertical (9:16) for social media platforms

You can combine multiple standard processing types (comma-separated) OR request vertical video alone.

## Troubleshooting

### Backend won't start
- Ensure all dependencies are installed: `npm install`
- Check that port 3000 is not already in use
- Verify the `.env` file exists and contains valid configuration

### API requests fail
- Verify the Frammer API key is correct in `.env`
- Check that the video URL is publicly accessible
- Ensure the backend server is running

### No webhook results
- Webhook URL must be configured in Frammer dashboard
- For local testing, use ngrok or similar to expose your local server
- Check backend console logs for incoming webhook data

### Frontend can't connect
- Ensure backend server is running on port 3000
- Check browser console for CORS or network errors
- Verify the API_BASE_URL in `frontend/script.js` matches your backend URL

## Development

### Adding Features

The codebase is structured for easy extension:
- Add new backend routes in `server.js`
- Modify frontend UI in `index.html` and `style.css`
- Add new functionality in `script.js`

### Database Integration

Currently results are stored in memory. For production:
1. Install a database (MongoDB, PostgreSQL, etc.)
2. Replace the `webhookResults` Map with database queries
3. Add persistence for all webhook events

## Security Notes

- The API key is stored in `.env` - **never commit this file to version control**
- Add `.env` to `.gitignore`
- For production, use proper authentication and HTTPS
- Validate all user inputs on the backend
- Consider rate limiting for the API endpoints

## API Documentation

Full Frammer API documentation can be found in:
`/Users/scott/Downloads/Video Processing API  - Frammer.pdf`

Key details:
- Endpoint: `https://demo.frammer.com/api/api_process_video`
- Authentication: API key in Authorization header
- Method: POST
- Content-Type: application/json

## Deploying to Railway

### Prerequisites
- GitHub account
- Railway account (sign up at https://railway.app)

### Deployment Steps

1. **Push code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Railway**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will automatically detect the Node.js app

3. **Configure Environment Variables**
   In Railway dashboard, add these variables:
   - `FRAMMER_API_KEY`: Your Frammer API key
   - `PORT`: Railway will auto-assign (or use 3000)
   - `WEBHOOK_URL`: Your Railway app URL + `/api/webhook`

4. **Get Your Railway URL**
   - Railway deployment URL: `https://web-production-e4a7d.up.railway.app`
   - Your webhook endpoint: `https://web-production-e4a7d.up.railway.app/api/webhook`
   - Frontend accessible at: `https://web-production-e4a7d.up.railway.app`

5. **Configure Frammer Webhook**
   - Go to your Frammer dashboard
   - Set the webhook URL to: `https://web-production-e4a7d.up.railway.app/api/webhook`
   - Save the configuration

6. **Update Frontend (Optional)**
   - If hosting frontend separately, update `API_BASE_URL` in `frontend/script.js`
   - Change from `http://localhost:3000` to your Railway URL

### Notes
- Railway offers free tier with some limitations
- The app will automatically restart on code changes
- Check Railway logs for debugging

## Support

For issues with:
- This application: Check the troubleshooting section above
- Frammer API: Contact Frammer AI support
- API authentication: Verify your API key with Frammer

## License

Copyright FRAMMER AI Pvt Ltd
