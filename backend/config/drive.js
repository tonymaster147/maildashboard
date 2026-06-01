const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

/**
 * Google Drive upload using OAuth2 with refresh token.
 * 
 * Service accounts don't have storage quota on personal Google accounts.
 * We use OAuth2 with a refresh token to upload as YOUR Google account,
 * which uses YOUR storage quota.
 */
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  'http://localhost:5000/api/auth/google/callback'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

/**
 * Upload a local file to Google Drive
 * @param {string} filePath - Absolute path to the local file
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @returns {Object} { fileId, fileUrl, downloadUrl }
 */
async function uploadToGoogleDrive(filePath, fileName, mimeType) {
  try {
    const fileMetadata = {
      name: `${Date.now()}_${fileName}`,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
    };

    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
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
    if (error.response) {
      console.error('Google API response:', JSON.stringify(error.response.data));
    }
    if (error.errors) {
      console.error('Google API errors:', JSON.stringify(error.errors));
    }
    throw new Error('Failed to upload file to Google Drive: ' + error.message);
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

// ───────────────────────── Chat attachments ─────────────────────────
//
// Layout on Drive:
//   <GOOGLE_DRIVE_FOLDER_ID>/
//     Chat Attachments/
//       Order #<id>/
//         <timestamp>_<filename>
//
// First call per process creates "Chat Attachments"; first call per order
// creates "Order #<id>". Both ids are cached in memory.

let chatRootIdPromise = null;
const orderFolderCache = new Map();

async function findOrCreateFolder(name, parentId) {
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
  const found = await drive.files.list({ q, fields: 'files(id, name)', pageSize: 1 });
  if (found.data.files && found.data.files.length > 0) return found.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id'
  });
  return created.data.id;
}

async function getChatRootId() {
  if (!chatRootIdPromise) {
    chatRootIdPromise = findOrCreateFolder('Chat Attachments', process.env.GOOGLE_DRIVE_FOLDER_ID)
      .catch(err => { chatRootIdPromise = null; throw err; });
  }
  return chatRootIdPromise;
}

async function getOrderChatFolderId(orderId) {
  if (orderFolderCache.has(orderId)) return orderFolderCache.get(orderId);
  const root = await getChatRootId();
  const id = await findOrCreateFolder(`Order #${orderId}`, root);
  orderFolderCache.set(orderId, id);
  return id;
}

/**
 * Upload a chat attachment to the per-order Drive subfolder.
 * Returns { fileId, fileUrl, downloadUrl } shaped like uploadToGoogleDrive.
 */
async function uploadChatAttachment(filePath, fileName, mimeType, orderId) {
  const parentId = await getOrderChatFolderId(orderId);
  const fileMetadata = { name: `${Date.now()}_${fileName}`, parents: [parentId] };
  const media = { mimeType, body: fs.createReadStream(filePath) };
  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id, webViewLink, webContentLink'
  });
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: { role: 'reader', type: 'anyone' }
  });
  return {
    fileId: response.data.id,
    fileUrl: `https://drive.google.com/file/d/${response.data.id}/view`,
    downloadUrl: response.data.webContentLink
  };
}

module.exports = { uploadToGoogleDrive, deleteFromGoogleDrive, uploadChatAttachment };
