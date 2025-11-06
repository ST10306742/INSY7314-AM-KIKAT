// Backend/server.js
const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const https = require("https");
const seedEmployees = require("./seed/seedEmployees");
const fs = require("fs");

const paymentRoutes = require('./routes/paymentRoutes');
const payfastRoutes = require('./routes/payfast');
const authRoutes = require("./routes/authRoutes");
const employeePaymentsRoutes = require('./routes/employeePaymentsRoutes');
//const generalLimiter = require('./middleware/rateLimiter');

dotenv.config();

// Environment setup
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "https://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// SSL certificate paths (make sure these are correct)
const options = {
  key: process.env.SSL_KEY,
  cert: process.env.SSL_CERT,
  minVersion: 'TLSv1.2', // only allow TLS 1.2+
  maxVersion: 'TLSv1.3', // cap at TLS 1.3
};

// Initialize Express app
const app = express();

// Parse JSON (and allow CSP reports)
app.use(express.json({ type: ["application/json", "application/csp-report"] }));

// Helmet (security middleware)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          FRONTEND_URL,
          !isProd && "'unsafe-eval'", // allow hot reload in dev
        ].filter(Boolean),
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          FRONTEND_URL,
          "https://localhost:5000",
          !isProd && `wss://${new URL(FRONTEND_URL).host}`,
          !isProd && `ws://${new URL(FRONTEND_URL).host}`,
        ].filter(Boolean),
        frameSrc: ["'self'", "https://sandbox.payfast.co.za"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", "https://sandbox.payfast.co.za"],
      },
    },
    crossOriginEmbedderPolicy: false, // needed for dev sometimes
  })
);

// CORS setup (after Helmet)
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Rate Limiting
//app.use(generalLimiter);


// Routes
app.use('/api/payments', paymentRoutes);
app.use('/api/payfast', payfastRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use('/api/employeepayments', employeePaymentsRoutes);


// Test endpoint
app.get("/test", (req, res) => res.json({ message: " Backend is running!" }));

// CSP violation report (for debugging)
app.post("/api/csp-report", (req, res) => {
  console.warn(" CSP Violation:", JSON.stringify(req.body, null, 2));
  res.status(204).end();
});

// Connect MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log(" MongoDB connected");
    await seedEmployees();
  })
  .catch((err) => console.error(" MongoDB connection error:", err));

// Start HTTPS Server
const server = https.createServer(options, app);

server.on('secureConnection', (tlsSocket) => {
  console.log(`Client connected using TLS version: ${tlsSocket.getProtocol()}`);
});

server.listen(PORT, () => {
  console.log(`Secure API running at https://localhost:${PORT}`);
  console.log(`Frontend URL allowed: ${FRONTEND_URL}`);
  console.log(`CSP mode: ${isProd ? 'ENFORCED' : 'REPORT-ONLY'}`);
});