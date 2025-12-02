
/**
 * API Configuration
 * 
 * Once you deploy your backend (Cloud Run / Node.js), update this URL.
 * The frontend will switch from using local storage to this API.
 */

export const API_CONFIG = {
    // Replace with your Cloud Run URL after deployment
    // e.g., 'https://my-church-api-xyz.a.run.app'
    BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:3000', 
    
    // Timeout for requests
    TIMEOUT: 10000,
    
    // Feature flags to toggle between Local Storage and SQL Backend
    USE_CLOUD_SQL: false 
};
