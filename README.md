# 🚀 Hashlay — Full-Stack E-Commerce System

> Production-ready backend + live-connected admin panel + customer website

---

## 📦 PROJECT STRUCTURE

```
hashlay-backend/               ← Node.js / Express / MongoDB API
├── server.js                  ← Entry point
├── package.json
├── .env.example               ← Copy to .env and fill in credentials
├── config/
│   ├── db.js                  ← MongoDB connection
│   ├── logger.js              ← Winston logger
│   └── cloudinary.js          ← Image upload config
├── models/
│   ├── Admin.js               ← Admin users
│   ├── Product.js             ← Products with pagination
│   ├── Order.js               ← Orders with timeline
│   ├── Customer.js            ← Customer accounts
│   └── index.js               ← Review, Coupon, Campaign, FAQ,
│                                 Chatbot, NotifyList, Contact,
│                                 Notification, ActivityLog, Settings
├── controllers/
│   ├── authController.js
│   ├── dashboardController.js
│   ├── productController.js
│   ├── orderController.js
│   ├── customerController.js
│   ├── settingsController.js
│   └── miscControllers.js     ← Reviews, Coupons, Campaigns,
│                                 FAQs, Chatbot, Notifications,
│                                 ActivityLog, Contacts, Admins, Analytics
├── routes/                    ← One file per resource (17 route files)
├── middleware/
│   ├── auth.js                ← JWT + role + permission guards
│   ├── errorHandler.js        ← Global error handler
│   └── activityLogger.js      ← Automatic activity logging
├── services/
│   ├── invoiceService.js      ← PDF invoice generation (PDFKit)
│   ├── emailService.js        ← Nodemailer + campaign sending
│   └── notificationService.js ← Real-time notification creation
├── utils/
│   ├── slugify.js
│   └── seed.js                ← Creates default admin + settings
└── logs/                      ← Auto-created log files

hashlay-admin-connected.html   ← Upgraded admin panel (live API)
hashlay-website-connected.html ← Upgraded customer website (live API)
```

---

## ⚡ QUICK START

### 1. Install & Configure Backend

```bash
cd hashlay-backend
npm install

# Copy env template
cp .env.example .env
```

Open `.env` and fill in:
```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/hashlay
JWT_SECRET=your_super_secret_key_here_make_it_long
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
RAZORPAY_KEY_ID=rzp_live_xxxxxxx
RAZORPAY_KEY_SECRET=your_secret
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
```

### 2. Seed Default Admin & Settings

```bash
npm run seed
```
This creates:
- **Admin:** `admin@hashlay.in` / `Admin@123`
- Default payment, delivery, announcement, SEO settings

### 3. Start Backend

```bash
npm run dev     # Development (with auto-restart)
npm start       # Production
```
→ Backend running at `http://localhost:5000`

### 4. Connect Frontends

**Admin Panel** (`hashlay-admin-connected.html`):
```html
<!-- Already configured. If deploying to different URL, add before closing </body>: -->
<script>window.HASHLAY_API = 'https://api.hashlay.in/api';</script>
```

**Customer Website** (`hashlay-website-connected.html`):
```html
<script>window.HASHLAY_API_URL = 'https://api.hashlay.in';</script>
```

### 5. Admin Access

To access the admin dashboard, navigate to the `/admin` route on your deployed domain. Use the credentials configured by your system administrator.

> 🌐 **Website:** [hashlay.in](https://hashlay.in)  
> 📸 **Instagram:** [@hashlay.in](https://instagram.com/hashlay.in)

---

## 🗄️ DATABASE SETUP (MongoDB Atlas)

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create database user with read/write permissions
4. Whitelist your IP (or use `0.0.0.0/0` for development)
5. Copy connection string → paste in `MONGO_URI` in `.env`

---

## ☁️ CLOUDINARY SETUP (Image Uploads)

1. Go to [cloudinary.com](https://cloudinary.com) → Free account
2. Dashboard → Copy Cloud Name, API Key, API Secret
3. Paste into `.env`

All product images upload to:
- `hashlay/products/` — product images (auto-resized to 1200×1200)
- `hashlay/banners/`  — banner images
- `hashlay/avatars/`  — admin avatars

---

## 💳 RAZORPAY SETUP

1. Go to [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Settings → API Keys → Generate Key
3. Copy Key ID and Secret → paste in `.env`
4. OR go to Admin Panel → Settings → Payment → enter Razorpay credentials there (live-updates website instantly)

**Webhook** (optional but recommended):
- Dashboard → Webhooks → Add: `https://api.hashlay.in/api/razorpay/webhook`
- Events: `payment.captured`

---

## 📧 EMAIL SETUP (Gmail)

1. Gmail → Account → Security → App Passwords
2. Generate app password for "Mail"
3. Add to `.env`:
   ```
   SMTP_USER=your@gmail.com
   SMTP_PASS=your_16_char_app_password
   ```

---

## 🚀 DEPLOYMENT

### Backend → Railway (recommended free tier)

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway up
```
Add all `.env` variables in Railway dashboard → Variables

### Backend → Render

1. Connect GitHub repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add environment variables in Render dashboard

### Frontend → Vercel / Netlify / GitHub Pages

Upload `hashlay-admin-connected.html` and `hashlay-website-connected.html`.
Set `window.HASHLAY_API_URL` in each file to your deployed backend URL.

---

## 📡 COMPLETE API REFERENCE

### Base URL
```
http://localhost:5000/api
```

### Authentication
All admin routes require:
```
Authorization: Bearer <jwt_token>
```
Get token from `POST /api/auth/login`

---

### 🔐 AUTH

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Public | Admin login → returns JWT |
| POST | `/auth/logout` | Admin | Logout + log activity |
| GET | `/auth/me` | Admin | Get current admin info |
| PATCH | `/auth/change-password` | Admin | Change password |

**Login request:**
```json
POST /api/auth/login
{ "email": "admin@hashlay.in", "password": "Admin@123" }
```
**Response:** `{ "success": true, "token": "eyJ...", "admin": {...} }`

---

### 📊 DASHBOARD

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard/stats` | Admin | All live stats cards |
| GET | `/dashboard/revenue-chart?range=7d` | Admin | Revenue + orders chart |
| GET | `/dashboard/order-status` | Admin | Order status pie chart |
| GET | `/dashboard/top-products` | Admin | Best-selling products |
| GET | `/dashboard/customer-growth` | Admin | Customer growth chart |

`range` options: `7d`, `30d`, `3m`, `1y`

---

### 📦 PRODUCTS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | Public | List products (paginated) |
| GET | `/products/featured` | Public | Featured products for homepage |
| GET | `/products/categories` | Public | All product categories |
| GET | `/products/slug/:slug` | Public | Get product by slug |
| GET | `/products/:id` | Public | Get product by ID |
| GET | `/products/:id/reviews` | Public | Approved reviews for product |
| POST | `/products` | Admin | Create product |
| PUT | `/products/:id` | Admin | Update product |
| DELETE | `/products/:id` | Admin | Soft-delete product |
| PATCH | `/products/:id/featured` | Admin | Toggle featured status |
| POST | `/products/bulk/action` | Admin | Bulk delete/feature/unfeature |
| GET | `/products/export/csv` | Admin | Export all products as CSV |
| POST | `/products/import/csv` | Admin | Import products from CSV file |

**Query params for GET /products:**
- `page`, `limit`, `sort`
- `search` — full text search
- `category` — filter by category
- `status` — `in_stock`, `low_stock`, `out_of_stock`
- `featured=true`

---

### 🛒 ORDERS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | Public | Create order (from website) |
| POST | `/orders/validate-coupon` | Public | Validate coupon code |
| GET | `/orders` | Admin | List orders (paginated) |
| GET | `/orders/:id` | Admin | Get single order |
| PATCH | `/orders/:id/status` | Admin | Update order/delivery status |
| DELETE | `/orders/:id` | Admin | Soft-delete order |
| GET | `/orders/export/csv` | Admin | Export orders as CSV |

**Create order body:**
```json
{
  "customerName": "Rahul Sharma",
  "customerEmail": "rahul@email.com",
  "customerPhone": "9876543210",
  "address": { "fullName":"Rahul", "addressLine1":"123 MG Road", "city":"Bangalore", "state":"Karnataka", "pincode":"560001" },
  "items": [{ "product":"<id>", "name":"Sneaker Kit", "price":599, "quantity":1, "total":599 }],
  "subtotal": 599,
  "total": 648,
  "deliveryCharge": 49,
  "paymentMethod": "cod"
}
```

**Update status body:**
```json
{
  "orderStatus": "shipped",
  "deliveryStatus": "dispatched",
  "trackingId": "DTDC123456",
  "message": "Order shipped via DTDC"
}
```

---

### 👥 CUSTOMERS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/customers/register` | Public | Customer registration |
| POST | `/customers/login` | Public | Customer login |
| GET | `/customers` | Admin | List customers |
| POST | `/customers` | Admin | Create customer manually |
| GET | `/customers/:id` | Admin | Get customer details |
| PUT | `/customers/:id` | Admin | Update customer |
| DELETE | `/customers/:id` | Admin | Deactivate customer |
| GET | `/customers/:id/orders` | Admin | Customer's order history |
| GET | `/customers/export/csv` | Admin | Export customers as CSV |

**Query params:** `filter=all|new|repeat|high_spenders`, `search`, `page`, `limit`

---

### ⭐ REVIEWS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/reviews` | Public | Submit review (pending) |
| GET | `/reviews` | Admin | List all reviews |
| PATCH | `/reviews/:id` | Admin | Approve/reject review |
| DELETE | `/reviews/:id` | Admin | Delete review |

---

### 🎟️ COUPONS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/coupons` | Admin | List all coupons |
| POST | `/coupons` | Admin | Create coupon |
| PATCH | `/coupons/:id` | Admin | Update coupon |
| DELETE | `/coupons/:id` | Admin | Delete coupon |

---

### 📣 CAMPAIGNS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/campaigns` | Admin | List campaigns |
| POST | `/campaigns` | Admin | Create campaign |
| POST | `/campaigns/:id/send` | Admin | Send campaign immediately |
| DELETE | `/campaigns/:id` | Admin | Delete campaign |

---

### ❓ FAQS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/faqs` | Public | List FAQs (`?active=true` for website) |
| POST | `/faqs` | Admin | Create FAQ |
| PATCH | `/faqs/:id` | Admin | Update FAQ |
| DELETE | `/faqs/:id` | Admin | Delete FAQ |

---

### 🤖 CHATBOT

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chatbot/match` | Public | Match user message → get response |
| GET | `/chatbot` | Admin | List chatbot rules |
| POST | `/chatbot` | Admin | Create chatbot rule |
| PATCH | `/chatbot/:id` | Admin | Update rule |
| DELETE | `/chatbot/:id` | Admin | Delete rule |

---

### ⚙️ SETTINGS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/settings/public` | **Public** | Non-sensitive settings for website |
| GET | `/settings` | Admin | All settings |
| GET | `/settings/:key` | Admin | Single setting |
| PUT | `/settings/:key` | Admin | Update setting |
| POST | `/settings/batch` | Admin | Update multiple settings |

**Setting keys:** `payment`, `delivery`, `announcement`, `seo`, `banner`, `store`, `shipping`

The `/settings/public` endpoint is used by the customer website to:
- Show/hide announcement bar
- Get delivery threshold (free delivery above ₹X)
- Get Razorpay Key ID (not secret)
- Get SEO meta tags
- Get banner image

---

### 🔔 NOTIFICATIONS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | Admin | List notifications |
| PATCH | `/notifications/:id/read` | Admin | Mark one as read |
| PATCH | `/notifications/all/read` | Admin | Mark all as read |
| DELETE | `/notifications/clear` | Admin | Clear read notifications |

---

### 📋 ACTIVITY LOG

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/activity-log` | Admin | List activity log |
| GET | `/activity-log/export` | Admin | Export log as CSV |

---

### 📬 OTHER ENDPOINTS

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/contacts` | Public | Submit contact message |
| GET | `/contacts` | Admin | List contact messages |
| PATCH | `/contacts/:id` | Admin | Resolve/update contact |
| DELETE | `/contacts/:id` | Admin | Delete contact |
| POST | `/notify-list` | Public | Add to notify list |
| GET | `/notify-list` | Admin | View notify list |
| GET | `/notify-list/export/csv` | Admin | Export as CSV |
| DELETE | `/notify-list/:id` | Admin | Delete entry |
| GET | `/analytics` | Admin | Analytics overview |
| POST | `/upload/product` | Admin | Upload product images |
| POST | `/upload/banner` | Admin | Upload banner image |
| GET | `/invoice/:orderId` | Admin | Download PDF invoice |
| POST | `/razorpay/create-order` | Public | Create Razorpay payment order |
| POST | `/razorpay/verify` | Public | Verify payment signature |
| POST | `/razorpay/webhook` | Public | Razorpay webhook handler |
| GET | `/admins` | Super Admin | List admin users |
| POST | `/admins` | Super Admin | Create admin |
| PATCH | `/admins/:id` | Super Admin | Update admin |
| DELETE | `/admins/:id` | Super Admin | Deactivate admin |
| GET | `/health` | Public | Health check |

---

## 🔒 SECURITY FEATURES

- **JWT Authentication** with 7-day expiry
- **Bcrypt** password hashing (12 rounds)
- **Rate limiting** — 300 req/min general, 20 req/15min on auth
- **Helmet** security headers
- **CORS** restricted to your domain
- **Input validation** on all endpoints
- **Activity logging** — every admin action recorded with IP + device
- **Soft deletes** — nothing is permanently deleted from DB
- **Role-based access** — super_admin, admin, editor, viewer

---

## 🌐 LIVE DATA FLOW

```
Admin Panel                    Customer Website
    │                               │
    ├─ Login (JWT)                  ├─ Loads on DOMContentLoaded
    │                               │
    ├─ Dashboard                    ├─ GET /settings/public
    │   └─ GET /dashboard/stats     │   └─ Razorpay key, delivery threshold,
    │                               │      announcement bar, SEO tags
    ├─ Add Product                  │
    │   └─ POST /products           ├─ GET /products?limit=50
    │   └─ Images → Cloudinary      │   └─ Renders product grid
    │                               │
    ├─ Update Settings              ├─ GET /reviews?status=approved
    │   └─ PUT /settings/payment    │   └─ Renders review cards
    │   └─ PUT /settings/announcement│
    │       └─ INSTANTLY updates    ├─ GET /faqs?active=true (popup)
    │          customer website     │
    │                               ├─ POST /orders (checkout)
    ├─ View Orders                  │
    │   └─ GET /orders              ├─ POST /razorpay/create-order
    │   └─ New order → notification │   └─ POST /razorpay/verify
    │                               │
    ├─ Update Order Status          ├─ POST /reviews (submit review)
    │   └─ PATCH /orders/:id/status │
    │                               ├─ POST /chatbot/match (AI chat)
    ├─ Send Campaign                │
    │   └─ POST /campaigns/:id/send ├─ POST /contacts (contact form)
    │   └─ Emails all customers     │
    │                               └─ POST /notify-list (signup form)
    └─ Download Invoice
        └─ GET /invoice/:orderId
            └─ PDF generated inline
```

---

## 🆘 TROUBLESHOOTING

**CORS error?**
→ Add your frontend URL to the `cors` origins array in `server.js`

**MongoDB connection failed?**
→ Check MONGO_URI format, whitelist your IP in Atlas

**Images not uploading?**
→ Check Cloudinary credentials in `.env`

**Razorpay payment not working?**
→ Ensure you're using the correct Key ID (not secret) in the website
→ Check Razorpay dashboard for failed payment logs

**Email not sending?**
→ Enable "Less secure app access" or use Gmail App Password
→ Check SMTP_PORT (587 for TLS, 465 for SSL)

**JWT expired?**
→ Change JWT_EXPIRE in `.env` (default 7d)
→ User needs to log in again

---

## 📞 SUPPORT

For issues: Check `logs/error.log` in the backend folder.

All API errors return:
```json
{ "success": false, "message": "Description of what went wrong" }
```
