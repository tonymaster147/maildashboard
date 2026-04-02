/**
 * Content Filter Service
 * Detects and blocks emails, phone numbers, and custom DB-banned phrases in chat messages
 */
const db = require('../config/db');

// Email regex pattern
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone number patterns (various formats)
const PHONE_REGEX = /(\+?\d{1,4}[-.\s]?)?(\(?\d{1,4}\)?[-.\s]?)?[\d\s.-]{6,15}\d/g;

// Additional patterns for obfuscated attempts
const OBFUSCATED_EMAIL_REGEX = /[a-zA-Z0-9._%+-]+\s*(?:@|at|AT)\s*[a-zA-Z0-9.-]+\s*(?:\.|dot|DOT)\s*[a-zA-Z]{2,}/gi;

// In-memory cache for banned words (refreshed every 60s)
let bannedWordsCache = [];
let bannedWordsCacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds

async function getBannedWords() {
  const now = Date.now();
  if (now - bannedWordsCacheTime < CACHE_TTL && bannedWordsCache.length >= 0 && bannedWordsCacheTime > 0) {
    return bannedWordsCache;
  }
  try {
    const [rows] = await db.query('SELECT word FROM banned_words WHERE is_active = 1');
    bannedWordsCache = rows.map(r => r.word.trim()).filter(Boolean);
    bannedWordsCacheTime = now;
  } catch (error) {
    console.error('Banned words fetch error:', error);
    // Return stale cache on error rather than failing
  }
  return bannedWordsCache;
}

/**
 * Filter message content for sensitive information
 * @param {string} message - The message to filter
 * @returns {Promise<Object>} { filteredMessage, isFlagged, flagReasons }
 */
async function filterMessage(message) {
  let filteredMessage = message;
  const flagReasons = [];
  let isFlagged = false;

  // 1. Check for basic emails
  if (EMAIL_REGEX.test(filteredMessage)) {
    filteredMessage = filteredMessage.replace(EMAIL_REGEX, '***');
    flagReasons.push('Email address detected');
    isFlagged = true;
  }
  EMAIL_REGEX.lastIndex = 0;

  // 2. Check for obfuscated emails
  if (OBFUSCATED_EMAIL_REGEX.test(filteredMessage)) {
    filteredMessage = filteredMessage.replace(OBFUSCATED_EMAIL_REGEX, '***');
    flagReasons.push('Obfuscated email detected');
    isFlagged = true;
  }
  OBFUSCATED_EMAIL_REGEX.lastIndex = 0;

  // 3. Check for phone numbers
  const phoneMatches = filteredMessage.match(PHONE_REGEX);
  if (phoneMatches) {
    phoneMatches.forEach(match => {
      const digitsOnly = match.replace(/\D/g, '');
      if (digitsOnly.length >= 7) {
        filteredMessage = filteredMessage.replace(match, '***');
        if (!flagReasons.includes('Phone number detected')) {
          flagReasons.push('Phone number detected');
        }
        isFlagged = true;
      }
    });
  }

  // 4. Check for dynamic Banned Words (from cache)
  const bannedWords = await getBannedWords();
  for (const word of bannedWords) {
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedWord = escapeRegExp(word);
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');

    if (regex.test(filteredMessage)) {
      filteredMessage = filteredMessage.replace(regex, '***');
      if (!flagReasons.includes(`Banned phrase: ${word}`)) {
        flagReasons.push(`Banned phrase: ${word}`);
      }
      isFlagged = true;
    }
  }

  return {
    filteredMessage,
    isFlagged,
    flagReason: flagReasons.join(', ')
  };
}

// Allow cache invalidation when banned words are updated
function invalidateBannedWordsCache() {
  bannedWordsCacheTime = 0;
}

module.exports = { filterMessage, invalidateBannedWordsCache };
