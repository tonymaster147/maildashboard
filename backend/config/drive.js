const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');
require('dotenv').config();

// Initialize Google Drive API using service account key file
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '..', 'lastgdrive-key.json'),
  scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });


/**
 * Upload a file buffer to Google Drive
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @returns {Object} { fileId, fileUrl }
 */
async function uploadToGoogleDrive(fileBuffer, fileName, mimeType) {
  try {
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileBuffer);

    const fileMetadata = {
      name: `${Date.now()}_${fileName}`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
    };

    const media = {
      mimeType: mimeType,
      body: bufferStream
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink'
    });

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return {
      fileId: response.data.id,
      fileUrl: `https://drive.google.com/file/d/${response.data.id}/view`,
      downloadUrl: response.data.webContentLink
    };
  } catch (error) {
    console.error('Google Drive upload error:', error.message);
    throw new Error('Failed to upload file to Google Drive');
  }
}

/**
 * Delete a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 */
async function deleteFromGoogleDrive(fileId) {
  try {
    await drive.files.delete({ fileId });
  } catch (error) {
    console.error('Google Drive delete error:', error.message);
  }
}

module.exports = { uploadToGoogleDrive, deleteFromGoogleDrive };
