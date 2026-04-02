const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Timeout to prevent hanging forever
setTimeout(() => {
  console.error('❌ TIMEOUT: Upload took more than 30 seconds. The API call is hanging.');
  console.error('This usually means a network/firewall issue or proxy blocking Google APIs.');
  process.exit(1);
}, 30000);

async function test() {
  console.log('=== Google Drive Upload Test ===\n');
  
  // Step 1: Check env
  console.log('1. Checking environment...');
  console.log('   GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID || '❌ NOT SET');
  
  // Step 2: Check key file
  console.log('\n2. Checking service account key...');
  const keyPath = path.join(__dirname, 'lastgdrive-key.json');
  if (!fs.existsSync(keyPath)) {
    console.error('   ❌ lastgdrive-key.json NOT FOUND');
    return;
  }
  const keyFile = require(keyPath);
  console.log('   Service account email:', keyFile.client_email);
  console.log('   Project ID:', keyFile.project_id);
  console.log('   Private key present:', keyFile.private_key ? '✅ Yes' : '❌ No');
  
  // Step 3: Test authentication
  console.log('\n3. Testing authentication...');
  const { google } = require('googleapis');
  const auth = new google.auth.JWT({
    email: keyFile.client_email,
    key: keyFile.private_key,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  try {
    const tokens = await auth.authorize();
    console.log('   ✅ Authentication successful! Token type:', tokens.token_type);
  } catch (authErr) {
    console.error('   ❌ Authentication FAILED:', authErr.message);
    if (authErr.response) {
      console.error('   Response:', JSON.stringify(authErr.response.data));
    }
    return;
  }

  // Step 4: Test listing files in the folder
  console.log('\n4. Testing folder access...');
  const drive = google.drive({ version: 'v3', auth });
  try {
    const listResp = await drive.files.list({
      q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`,
      pageSize: 3,
      fields: 'files(id, name)'
    });
    console.log('   ✅ Folder access works! Files found:', listResp.data.files.length);
    if (listResp.data.files.length > 0) {
      listResp.data.files.forEach(f => console.log('     -', f.name));
    }
  } catch (listErr) {
    console.error('   ❌ Folder access FAILED:', listErr.message);
    if (listErr.response) {
      console.error('   Status:', listErr.response.status);
      console.error('   Response:', JSON.stringify(listErr.response.data));
    }
    return;
  }

  // Step 5: Test actual upload
  console.log('\n5. Testing file upload...');
  const dummyFile = path.join(__dirname, 'dummy_test.txt');
  fs.writeFileSync(dummyFile, 'Hello Google Drive! Test at ' + new Date().toISOString());

  try {
    const { uploadToGoogleDrive } = require('./config/drive');
    const result = await uploadToGoogleDrive(dummyFile, 'test_file.txt', 'text/plain');
    console.log('   ✅ Upload SUCCESS!');
    console.log('   File ID:', result.fileId);
    console.log('   View URL:', result.fileUrl);
    console.log('   Download URL:', result.downloadUrl);
  } catch (uploadErr) {
    console.error('   ❌ Upload FAILED:', uploadErr.message);
  } finally {
    if (fs.existsSync(dummyFile)) {
      fs.unlinkSync(dummyFile);
    }
  }

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

test();
