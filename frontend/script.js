// Configuration
const API_BASE_URL = 'http://localhost:3000';

// DOM Elements
const videoForm = document.getElementById('videoForm');
const submissionStatus = document.getElementById('submissionStatus');
const resultsContainer = document.getElementById('resultsContainer');
const refreshButton = document.getElementById('refreshResults');

// Store original video URLs for filename generation
let originalVideoNames = {};

// Show status message
function showStatus(message, type = 'info') {
    submissionStatus.textContent = message;
    submissionStatus.className = `status-message show ${type}`;

    if (type === 'success') {
        setTimeout(() => {
            submissionStatus.classList.remove('show');
        }, 5000);
    }
}

// Generate download filename from original filename
function generateDownloadFilename(originalFilename) {
    if (!originalFilename) return 'video VERTICAL.mp4';

    // Remove .mp4 extension if present
    let baseName = originalFilename;
    if (baseName.toLowerCase().endsWith('.mp4')) {
        baseName = baseName.slice(0, -4);
    }

    // Add " VERTICAL.mp4"
    return `${baseName} VERTICAL.mp4`;
}

// Download video with custom filename
async function downloadVideo(videoUrl, filename) {
    try {
        showStatus(`Downloading ${filename}...`, 'info');

        const response = await fetch(videoUrl);
        const blob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showStatus(`Downloaded ${filename} successfully!`, 'success');
    } catch (error) {
        console.error('Download error:', error);
        showStatus(`Failed to download: ${error.message}`, 'error');
    }
}

// Handle form submission
videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(videoForm);
    const videoUrl = formData.get('videoUrl');
    const language = formData.get('language');
    const contentType = formData.get('contentType');

    // Get selected output types
    const outputTypes = Array.from(formData.getAll('outputType'));

    if (outputTypes.length === 0) {
        showStatus('Please select at least one output type', 'error');
        return;
    }

    // Join output types with comma
    const outputType = outputTypes.join(',');

    const submitButton = videoForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';

    try {
        showStatus('Submitting video for processing...', 'info');

        const response = await fetch(`${API_BASE_URL}/api/process-video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                videoUrl,
                language,
                contentType,
                outputType
            })
        });

        const result = await response.json();

        if (response.ok && result.status === 'success') {
            showStatus(
                `Video submitted successfully! Request ID: ${result.data.data?.id || 'N/A'}`,
                'success'
            );

            // Reset form
            videoForm.reset();

            // Refresh results after a short delay
            setTimeout(() => {
                loadResults();
            }, 1000);
        } else {
            showStatus(
                `Error: ${result.message || 'Failed to submit video'}`,
                'error'
            );
        }
    } catch (error) {
        console.error('Submission error:', error);
        showStatus(
            `Network error: ${error.message}. Make sure the backend server is running.`,
            'error'
        );
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Process Video';
    }
});

// Load and display results
async function loadResults() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/results`);
        const result = await response.json();

        if (response.ok && result.status === 'success') {
            displayResults(result.data);
        } else {
            resultsContainer.innerHTML = '<p class="no-results">Error loading results</p>';
        }
    } catch (error) {
        console.error('Error loading results:', error);
        resultsContainer.innerHTML = '<p class="no-results">Error connecting to server</p>';
    }
}

// Display results in the UI
function displayResults(results) {
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">No results yet. Submit a video to get started.</p>';
        return;
    }

    // Sort by timestamp, newest first
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const html = results.map(result => {
        const statusBadge = `<span class="result-badge badge-${result.status}">${result.status}</span>`;
        const timestamp = new Date(result.timestamp).toLocaleString();

        // Extract filename from URL
        let videoName = 'Unknown';
        if (result.videoUrl) {
            try {
                const urlParts = result.videoUrl.split('/');
                videoName = urlParts[urlParts.length - 1] || result.videoUrl;
                // Store original video name for this request ID
                originalVideoNames[result.id] = videoName;
            } catch (e) {
                videoName = result.videoUrl;
            }
        }

        let webhookInfo = '';
        if (result.lastWebhook) {
            webhookInfo = `
                <details class="result-details">
                    <summary>View Processing Details</summary>
                    <div>
                        <p><strong>Event:</strong> ${result.lastWebhook.event}</p>
                        <p><strong>Last Update:</strong> ${new Date(result.lastWebhook.timestamp).toLocaleString()}</p>
                        ${renderInsights(result.lastWebhook.data.insights, result.id)}
                    </div>
                </details>
            `;
        }

        return `
            <div class="result-card">
                <h3>Request ID: ${result.id}</h3>
                ${result.videoUrl ? `<p class="video-name"><strong>Video:</strong> ${videoName}</p>` : ''}
                <div class="result-meta">
                    ${statusBadge}
                    <span class="result-timestamp">Submitted: ${timestamp}</span>
                </div>
                ${webhookInfo}
            </div>
        `;
    }).join('');

    resultsContainer.innerHTML = html;

    // Re-attach download button listeners
    attachDownloadListeners();
}

// Render insights from webhook data
function renderInsights(insights, requestId) {
    if (!insights || insights.length === 0) {
        return '<p>No insights available yet.</p>';
    }

    return `
        <div class="insights-container">
            <h4>Processing Insights:</h4>
            ${insights.map(insight => `
                <div class="insight-item">
                    <h4>${insight.video_type.replace('-', ' ')}</h4>
                    ${renderInsightData(insight.data, requestId)}
                </div>
            `).join('')}
        </div>
    `;
}

// Render insight data items
function renderInsightData(data, requestId) {
    if (!data || data.length === 0) {
        return '<p>No data available</p>';
    }

    return data.map((item, index) => {
        let metaInfo = '';

        if (item.meta && Object.keys(item.meta).length > 0) {
            metaInfo = `
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #667eea;">View Metadata</summary>
                    <div style="margin-top: 10px;">
                        ${item.meta.asset_name ? `<p><strong>Title:</strong> ${item.meta.asset_name}</p>` : ''}
                        ${item.meta.asset_description ? `<p><strong>Description:</strong> ${item.meta.asset_description}</p>` : ''}
                        ${item.meta.asset_tags ? `<p><strong>Tags:</strong> ${item.meta.asset_tags}</p>` : ''}
                        ${item.meta.s3_heroimage_url ? `<p><strong>Hero Image:</strong> <a href="${item.meta.s3_heroimage_url}" target="_blank" class="video-link">View</a></p>` : ''}
                        ${item.meta.s3_thumbnail_url ? `<p><strong>Thumbnail:</strong> <a href="${item.meta.s3_thumbnail_url}" target="_blank" class="video-link">View</a></p>` : ''}
                        ${item.meta.s3_vtt_url ? `<p><strong>Subtitles:</strong> <a href="${item.meta.s3_vtt_url}" target="_blank" class="video-link">Download VTT</a></p>` : ''}
                    </div>
                </details>
            `;
        }

        // Add download button if video is done
        let videoLink = '';
        if (item.video_uri) {
            if (item.status === 'done') {
                videoLink = `
                    <p>
                        <strong>Video:</strong>
                        <a href="${item.video_uri}" target="_blank" class="video-link">View Video</a>
                        <button class="btn-download" data-video-url="${item.video_uri}" data-request-id="${requestId}">
                            Download VERTICAL
                        </button>
                    </p>
                `;
            } else {
                videoLink = `<p><strong>Video:</strong> <a href="${item.video_uri}" target="_blank" class="video-link">View Video</a></p>`;
            }
        }

        return `
            <div style="padding: 10px; background: #f5f5f5; border-radius: 4px; margin-bottom: 10px;">
                <p><strong>Video ID:</strong> ${item.video_id}</p>
                <p><strong>Status:</strong> ${item.status}</p>
                ${videoLink}
                ${metaInfo}
            </div>
        `;
    }).join('');
}

// Attach download button listeners
function attachDownloadListeners() {
    const downloadButtons = document.querySelectorAll('.btn-download');
    downloadButtons.forEach(button => {
        button.addEventListener('click', function() {
            const videoUrl = this.getAttribute('data-video-url');
            const requestId = this.getAttribute('data-request-id');
            const originalFilename = originalVideoNames[requestId] || 'video.mp4';
            const downloadFilename = generateDownloadFilename(originalFilename);

            downloadVideo(videoUrl, downloadFilename);
        });
    });
}

// Refresh results button
refreshButton.addEventListener('click', () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Refreshing...';

    loadResults().finally(() => {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh Results';
    });
});

// Auto-refresh results every 10 seconds
setInterval(loadResults, 10000);

// Load results on page load
loadResults();
