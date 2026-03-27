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

  // 4. Check for dynamic Banned Words from Database
  try {
    const [banned] = await db.query('SELECT word FROM banned_words WHERE is_active = 1');
    for (const row of banned) {
      const word = row.word.trim();
      if (!word) continue;
      
      // We will match the word case-insensitively, allowing boundaries to make sure it's somewhat isolated,
      // or we can just replace as substring. For security phrases, substring replacement is safer but could false-positive.
      // E.g. word "email" matches "email", "emails". We'll use word boundaries.
      // For literal phrases like ".com", etc. we need to escape regex chars.
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
  } catch (error) {
    console.error('Banned words fetch error:', error);
  }

  return {
    filteredMessage,
    isFlagged,
    flagReason: flagReasons.join(', ')
  };
}

module.exports = { filterMessage };
