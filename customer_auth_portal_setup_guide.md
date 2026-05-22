# Hashlay Customer Authentication & Portal System — Setup & Deployment Guide

This guide details all files created and modified for the customer authentication, portal, and live support chat system, along with the step-by-step setup and environment configuration instructions.

---

## 📂 Summary of Created & Modified Files

All files have been successfully structured and verified for syntax. They are fully backward-compatible and integrate cleanly with existing storefront and admin architectures.

### 🆕 1. Newly Created Files

| File Path | Description |
| :--- | :--- |
| **`models/OtpCode.js`** | Database schema for 6-digit verification codes (OTP) with built-in Mongo TTL (Time-To-Live) index for automatic expiration/cleanup. |
| **`models/ChatSession.js`** | Database schema for tracking live support conversation channels, user status (open/resolved), typing state, and unread counters. |
| **`models/ChatMessage.js`** | Database schema for messaging logs, sender roles (customer vs. admin), message payloads, and message delivery statuses (read/unread). |
| **`services/otpService.js`** | Core utility for generating, rate-limiting, and securely hashing OTP codes via bcrypt (cost factor: 12). |
| **`services/customerAuthEmailService.js`** | Dynamic email dispatcher that uses custom SMTP overrides from Admin Settings or defaults to fallback environmental variables. Also includes standard Fast2SMS integration. |
| **`controllers/customerAuthController.js`** | Handles endpoint logic for OTP requests, OTP validation, customer JWT generation, profile management, and direct password setups. |
| **`controllers/chatController.js`** | Short-polling chat orchestration (typing indicators, message feeds, status toggles) designed to bypass Vercel serverless environment constraints. |
| **`routes/customerAuth.js`** | Exposes router endpoints under `/api/customer-auth/*` (sending, verifying, profiles, my orders, order tracking). |
| **`routes/chat.js`** | Exposes router endpoints under `/api/chat/*` for both client storefront channels and administrator dashboards. |
| **`portal.html`** | Standalone premium glassmorphic client-facing authentication portal allowing easy sign-ins, order history lookup, live order tracking, and live helpdesk support. |

### 🛠️ 2. Modified Files

| File Path | Modifications Made |
| :--- | :--- |
| **`models/Customer.js`** | Extended schema to include `lastLoginAt`, `authMethod`, and `isVerified` flags without breaking existing checkout creations. |
| **`server.js`** | Mounted new router channels `/api/customer-auth` and `/api/chat` and added route matching for `/portal` serving `portal.html`. |
| **`vercel.json`** | Configured clean routing rule to map `/portal` to serverless routes correctly on deployment. |
| **`hashlay-admin.html`** | Integrated Customer Auth Settings configurations (SMTP and SMS keys) and built out the fully responsive Live Support Inbox tab panel. |
| **`final.html`** | Integrated beautiful, non-intrusive inline "Verify Email" verification, real-time OTP checks, and instant checkout address auto-filling. |

---

## ⚡ Environment & Setup Instructions

To activate all features, add or check the following variables inside your server `.env` file (or Vercel environment dashboard):

### 1. Verification fallbacks (Optional)
If no overrides are set inside the Admin Settings dashboard, the portal will fall back to these `.env` properties:
```env
# Falls back to SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS defined in .env
CUSTOMER_SMTP_HOST=smtp.gmail.com
CUSTOMER_SMTP_PORT=587
CUSTOMER_SMTP_USER=contacthashlay@gmail.com
CUSTOMER_SMTP_PASS=your-app-password
CUSTOMER_SMTP_FROM_NAME="Hashlay Support"
CUSTOMER_SMTP_FROM_EMAIL=contacthashlay@gmail.com
```

### 2. SMS Gateway Configuration (Only if phone login is enabled)
If you enable phone-based login via admin settings, ensure you obtain a Fast2SMS account and configure the key:
```env
FAST2SMS_API_KEY=your_fast2sms_api_key_here
```

---

## 🚀 Execution & Verification

### **Step 1: Install new dependencies (if not already done)**
Make sure all required core libraries are installed inside your root directory:
```bash
npm install jsonwebtoken bcryptjs xss-clean
```

### **Step 2: Start the server locally**
Run the server to verify startup integrity:
```bash
npm run dev
```

### **Step 3: Accessing the newly created pages**
* **Customer Portal**: Navigate to `http://localhost:5000/portal` (or your production deployment domain `/portal`).
* **Admin Support Chat**: Go to `http://localhost:5000/hashlay-admin.html` and click on **💬 Support** or **🔐 Customer Auth** inside Settings!
* **Inline Checkout**: Go to checkout on the main store page, enter an email, and experience the smooth inline verification and profile autofill.
