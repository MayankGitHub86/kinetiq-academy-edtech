/**
 * Kinetiq Academy Global Client Configuration
 */
window.KINETIQ_CONFIG = {
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api/v1'
    : '/api/v1',
  SOCKET_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000'
    : '/',
  PORTAL_PORT: 5500,
  STRIPE_PUBLISHABLE_KEY: 'pk_live_51UDWBJ1cHRiKMg2bkpX6NQVKKWNFD2mqxAwJPzsiqw9A9xryMvEkBDqEhHxP0PMWXMBHGx756bRN1xgQXRsABIL000jEUIrAh3',
};
