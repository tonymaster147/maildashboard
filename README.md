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
- **File Storage**: Local Multer Disk Storage (`backend/uploads/`)
- **Authentication**: JWT (JSON Web Tokens) with role-based access control (RBAC)

---

## 🚀 Features

### 👤 User Panel
- **Multi-Step Checkout**: Browse services, select subjects/education levels, choose pricing plans (Essential, Priority, VIP), and upload requirement files.
- **Stripe Integration**: Secure payment processing with discount coupon support, urgent delivery fees, and seamless cancellation recovery.
- **Order Tracking**: View active, completed, and pending orders.
- **Real-Time Chat**: Direct, secure 1-to-1 messaging with assigned tutors specifically for each order, complete with live unread counts, audio notifications, and per-order chat badges.
- **Seamless Authentication**: Login via unique numeric Access Code with a built-in automated "Forgot Access Code" email recovery system.
- **Automated Emails**: Receive beautiful HTML email confirmations upon order draft creation and successful payment.

### 🎓 Tutor Panel
- **Task Management**: View assigned tasks, deadlines (Start/End dates), and instructions.
- **File Delivery**: Upload completed project files for the user to review.
- **Status Updates**: Mark orders as completed.
- **Direct Messaging**: Chat with the client securely via Socket.io with live, per-task unread notification badges.

### 🛡️ Admin Panel
- **Dashboard**: High-level overview of revenue, active orders, and user metrics.
- **Order Management**: Adjust order statuses, assign specific tutors to active orders, and monitor deadlines.
- **User & Tutor Management**: Add new tutors, block/unblock users.
- **Chat Monitor**: Real-time view of all platform conversations.
- **Smart Chat Censor**: Automatically flags and blocks specific phrases (configurable), phone numbers, and email patterns to prevent off-platform communication.
- **Reporting Engine**: Advanced filtering by payment status, project status, dates, and assigned tutors, with CSV Export functionality.
- **Dynamic Configuration**: Configure pricing plans, add/remove discount coupons, and manage security banned phrases dynamically from the UI.

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
- Admin Panel: `5174`
- Tutor Panel: `5175`

---

## 🔐 Default Credentials

**Admin Access:**
- Username: `admin`
- Password: `admin123`

*(Ensure you change these in production or delete the seed data!)*

---

## 📂 Project Structure

```text
├── backend/
│   ├── config/          # Database, Stripe configs
│   ├── controllers/     # API logic (Orders, Auth, Admin, etc.)
│   ├── middleware/      # JWT auth, role verification
│   ├── routes/          # Express route definitions
│   ├── services/        # Helper services (Content Filter, Emails)
│   ├── socket/          # Socket.io chat handlers
│   └── uploads/         # Local file storage
├── frontend-admin/      # Admin React SPA
├── frontend-tutor/      # Tutor React SPA
└── frontend-user/       # User React SPA
```

## 🧠 For AI Assistants
*If you are an AI reading this codebase to assist the developer:*
- The platform uses **Vanilla CSS** with global CSS variables (e.g., `var(--bg-dark)`) defined in `index.css` for each frontend. Avoid importing external CSS frameworks like Tailwind or Bootstrap unless explicitly requested.
- When modifying form elements in the Admin Panel, utilize the global `.form-input` and `.form-select` classes for design consistency.
- Database foreign keys strictly enforce data integrity. If altering checkout/file flows, ensure matching metadata is passed down post-Stripe webhook.
