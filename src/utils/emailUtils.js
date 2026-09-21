/**
 * Utility functions for email handling and Gmail redirection
 */

/**
 * Generates a Gmail web compose URL for the given email address.
 * Opening this URL launches Gmail compose with the recipient pre-filled.
 *
 * @param {string} email - Recipient email address
 * @returns {string} Gmail compose URL
 */
export const getGmailComposeUrl = (email) => {
  if (!email || typeof email !== 'string') return '';
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email.trim())}`;
};
