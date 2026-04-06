# EduPro - Tutoring & Academic Services Platform

A comprehensive, full-stack platform for booking, managing, and delivering academic services, tutoring, and freelance project work. 

The system features real-time communication, automated payment processing, and three distinct role-based dashboards (User, Tutor, and Admin) for seamless workflow management from order placement to final delivery.

## 🏗 System Architecture

The project is built as a monorepo containing four main services:

1. **`backend/`** - Node.js / Express.js API & Socket.io Server
2. **`frontend-user/`** - React.js interface for customers/students
3. **`frontend-tutor/`** - React.js interface for assigned tutors/freelancers
4. **`frontend-admin/`** - React.js interface for platform administrators

### Tech Stack
- **Database Backend**: MySQL (with `mysql2` promise wrapper)
- **API Framework**: Node.js with Express.js
- **Frontend**: React (Vite) with vanilla CSS (dark mode theme)
- **Real-Time Engine**: Socket.io (for live chat & online status)
- **Payments**: Stripe Checkout Integration
- **Emails**: Nodemailer with SMTP Integration (HTML templates, order confirmation, access code recovery)
- **File Storage**: Google Drive API with local Multer fallback (`backend/uploads/`)
- **Authentication**: JWT (JSON Web Tokens) with role-based access control (RBAC)
- **Rate Limiting**: express-rate-limit for API and auth endpoints

---

## 🚀 Features

### 👤 User Panel
- **Multi-Step Checkout**: Browse services, select subjects/education levels, choose pricing plans (Essential, Priority, VIP), and upload requirement files.
- **Stripe Integration**: Secure payment processing with discount coupon support, urgent delivery fees, and seamless cancellation recovery.
- **Order Tracking**: View active, completed, and pending orders.
- **2-Way Chat System**: Two separate chat channels per order — **Tutor Chat** (talk to your assigned tutor) and **Support Chat** (talk to admin/sales team). Each channel is fully isolated with its own messages, unread counts, and notification sounds. Chat buttons are accessible from the Orders list, Order Detail page, and dedicated Chat page.
- **Seamless Authentication**: Login via unique numeric Access Code with a built-in automated "Forgot Access Code" email recovery system.
- **Automated Emails**: Receive beautiful HTML email confirmations upon order draft creation and successful payment.

### 🎓 Tutor Panel
- **Task Management**: View assigned tasks, deadlines (Start/End dates), and instructions.
- **File Delivery**: Upload completed project files for the user to review.
- **Status Updates**: Mark orders as completed.
- **Direct Messaging**: Dedicated tutor-only chat channel with the client via Socket.io, with live per-task unread notification badges and highlighted unread chats.

### 🛡️ Admin Panel
- **Dashboard**: High-level overview of revenue, active orders, and user metrics (parallel-optimized DB queries).
- **Order Management**: Adjust order statuses, assign specific tutors to active orders, and monitor deadlines.
- **User & Tutor Management**: Add new tutors, block/unblock users.
- **File Management**: Upload and delete files on any order directly from the order detail page.
- **Chat Monitor**: Real-time view of all platform conversations across both channels.
- **Customer Chat**: Direct real-time support channel chat with customers on their orders, with per-order unread badges, live WebSocket notifications, and audio alerts.
- **Smart Chat Censor**: Automatically flags and blocks specific phrases (in-memory cached, configurable), phone numbers, and email patterns to prevent off-platform communication.
- **Reporting Engine**: Advanced filtering by payment status, project status, dates, and assigned tutors, with CSV Export functionality.
- **Dynamic Configuration**: Configure pricing plans, add/remove discount coupons, and manage security banned phrases dynamically from the UI.
- **Sales Team Management**: Create and manage sales users (Sales Lead / Sales Executive) with granular per-menu permission controls.

### 📊 Sales Panel (Sales Lead / Sales Executive)
- **Role-Based Access**: Sales users access a subset of admin features based on individually assigned menu permissions (Dashboard, Users, Tutors, Orders, Chat Monitor, Reports, Settings, Customer Chat).
- **Full Tutor CRUD**: Sales users with Tutors permission can add, edit, and delete tutors.
- **Customer Chat**: Dedicated real-time support channel chat interface for communicating with customers, with per-order unread badges, live WebSocket notifications, and audio alerts.
- **Order Management**: View orders, update statuses, assign tutors, and upload files to orders.
- **Permission-Gated Routes**: Backend enforces permissions per endpoint via `requirePermission` middleware on `/api/sales/` routes.

---

## 🛠 Prerequisites

- Node.js (v16+)
- MySQL Server (v8+)
- Stripe Account (for API keys)

---

## 📦 Local Development Setup

### 1. Database Configuration
1. Create a MySQL database named `tutoring_platform` (or your preferred name).
2. Import the schema provided in `backend/schema.sql`.

### 2. Backend Initialization
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=tutoring_platform
JWT_SECRET=your_super_secret_jwt_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:5173/payment-success
STRIPE_CANCEL_URL=http://localhost:5173/new-order

# Email & SMTP Settings
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=support@yourdomain.com
SMTP_PASS=your_email_password
EMAIL_FROM="EduPro Support" <support@yourdomain.com>
ADMIN_EMAIL=admin@yourdomain.com
```
Start the server:
```bash
npm start
```

### 3. Frontend Initialization
You need to run each frontend separately. For each directory (`frontend-user`, `frontend-admin`, `frontend-tutor`):
```bash
cd <frontend-directory>
npm install
npm run dev
```

**Default Development Ports:**
- Backend API: `5000`
- User Panel: `5173`
- Admin Panel / Sales Panel: `5174`
- Tutor Panel: `5175`

---

## 🔐 Default Credentials

**Admin Access:**
- Username: `admin`
- Password: `admin123`

**Sales Access:**
- Created via Admin Panel → Sales Team page
- Login at the same Admin Panel URL (`/login`) using sales credentials

*(Ensure you change these in production or delete the seed data!)*

---

## 📂 Project Structure

```text
├── backend/
│   ├── config/          # Database, Stripe, Google Drive configs
│   ├── controllers/     # API logic (Orders, Auth, Admin, Chat, Files, etc.)
│   ├── middleware/      # JWT auth, role verification, rate limiting, file upload
│   ├── migrations/      # Database migration scripts
│   ├── routes/          # Express route definitions (admin, sales, tutor, etc.)
│   ├── services/        # Helper services (Content Filter with caching, Emails)
│   ├── socket/          # Socket.io chat handlers with room management
│   └── uploads/         # Local file storage (fallback)
├── frontend-admin/      # Admin React SPA
├── frontend-tutor/      # Tutor React SPA
└── frontend-user/       # User React SPA
```

## ⚡ Performance & Reliability
- **Database Connection Pooling**: MySQL pool with 50 connections, idle timeout, and connection health monitoring.
- **Banned Words Caching**: Content filter caches banned words in memory (60s TTL) to avoid per-message DB queries.
- **Sender Name Caching**: Socket chat handler caches sender name lookups to reduce repeated DB queries.
- **Cursor-Based Read Tracking**: Per-user `chat_read_cursors` table prevents cross-reader conflicts (tutor reading doesn't clear admin's unread count).
- **Channel-Isolated Chat**: `channel` column (`tutor`/`support`) on chats table with channel-filtered queries and socket routing ensures complete message isolation.
- **Parallel DB Queries**: Dashboard stats and chat notifications use `Promise.all` for concurrent execution.
- **Socket Room Deduplication**: Prevents duplicate room joins and unnecessary DB verification queries.
- **Rate Limiting**: 1000 req/15min for API, 10 req/15min for auth, 50 req/hr for file uploads.

## 🧠 For AI Assistants
*If you are an AI reading this codebase to assist the developer:*
- The platform uses **Vanilla CSS** with global CSS variables (e.g., `var(--bg-dark)`) defined in `index.css` for each frontend. Avoid importing external CSS frameworks like Tailwind or Bootstrap unless explicitly requested.
- When modifying form elements in the Admin Panel, utilize the global `.form-input` and `.form-select` classes for design consistency.
- Database foreign keys strictly enforce data integrity. If altering checkout/file flows, ensure matching metadata is passed down post-Stripe webhook.
- Sales users share the `frontend-admin` codebase. Use the `useApi()` hook (not direct API imports) to ensure correct endpoint routing based on role. The `useAuth().isSalesUser` flag determines which API prefix is used (`/api/admin/` vs `/api/sales/`).
- Socket notifications use a `useRef` pattern for `location.pathname` to avoid stale closures and listener re-registration on every navigation.
- The chat system uses a `channel` column (`tutor` or `support`) on the `chats` table. Backend socket handler routes messages only to the correct channel recipients via `emitToAdminSales()` (direct socket iteration) for support channel and personal rooms (`tutor_{id}`, `user_{id}`) for tutor channel.
- Unread tracking uses the `chat_read_cursors` table (per-user, per-order timestamps) instead of a shared `is_read` flag, preventing cross-reader conflicts.
