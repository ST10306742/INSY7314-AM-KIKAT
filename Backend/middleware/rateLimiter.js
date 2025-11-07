// Backend/middleware/rateLimiter.js    
const rateLimit = require('express-rate-limit');

// General rate limiter (applies to all routes)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 requests per windowMs
  message: {
    status: 429,
    message: "Too many requests from this IP, please try again later."
  },
  standardHeaders: true, // return rate limit info in headers
  legacyHeaders: false, // disable X-RateLimit-* headers
});

module.exports = generalLimiter;
