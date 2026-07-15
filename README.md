# Santa Catalina Tax Revenue System

A desktop-based **Business Permit and Licensing / Tax Revenue Management System** developed for the **Municipality of Santa Catalina, Negros Oriental**. The system streamlines business registration, tax assessment, payment processing, official receipt generation, delinquent account monitoring, reporting, and user management through a modern Electron desktop application.

---

# Features

## Dashboard
- Revenue overview and analytics
- Collection summaries
- Business statistics
- Delinquent account monitoring
- Charts and KPI cards

## Business & Owner Management
- Register business owners
- Register businesses
- Search and filter records
- Edit and update information
- Business status monitoring

## Tax Assessment
- Business tax computation
- Mayor's Permit assessment
- Regulatory fee computation
- Automatic tax calculation
- Assessment history

## Payments
- Business Tax payments
- Mayor's Permit payments
- Regulatory Fee payments
- Full / Quarterly / Biannual payments
- Automatic balance computation
- Official OR Number support

## Official Receipts
- Official Receipt Form 51
- Printable receipts
- Receipt history
- Receipt preview

## Delinquent Accounts
- Automatic overdue detection
- Interest computation
- Outstanding balances
- Delinquent reports

## Reports
- Revenue reports
- Payment reports
- Business reports
- Collection summaries
- Printable reports

## User Management
- User accounts
- Roles and permissions
- Authentication
- JWT Security

## Notifications
- Payment notifications
- Delinquent reminders
- Dashboard notifications

---

# Technology Stack

## Frontend

- React
- Vite
- Tailwind CSS
- React Router
- Axios
- TanStack Query
- Lucide React

## Backend

- Node.js
- Express.js
- SQLite (better-sqlite3)

## Desktop

- Electron
- Electron Builder

---

# Project Structure

```
Tax-Revenue-System
│
├── electron/
│   ├── main.js
│   └── preload.js
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── scheduler/
│   ├── scripts/
│   ├── sql/
│   ├── utils/
│   ├── data/
│   └── server.js
│
├── sta-catalina-btrf/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── config/
│   │   ├── constants/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
│
├── package.json
├── docker-compose.yml
└── schema.sql
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/earljohnobanana/Tax-Revenue-System.git
```

```
cd Tax-Revenue-System
```

---

## Install Dependencies

Root

```bash
npm install
```

Frontend

```bash
cd sta-catalina-btrf
npm install
```

Backend

```bash
cd ../
npm install
```

---

# Development

Run the application

```bash
npm run dev
```

---

# Build Desktop Application

```bash
npm run package:win
```

The generated installer will be available in the **release/** folder.

---

# Default Architecture

```
Electron Desktop
        │
        ▼
React + Vite Frontend
        │
        ▼
Express REST API
        │
        ▼
SQLite Database
```

---

# Main Modules

- Dashboard
- Business Owners
- Businesses
- Tax Assessment
- Payments
- Regulatory Fees
- Official Receipts
- Delinquent Accounts
- Reports
- User Management
- Notifications
- Authentication
- Audit Logs
- Settings

---

# Security

- JWT Authentication
- Protected API Routes
- Role-Based Access Control
- Secure Electron IPC Communication
- Context Isolation Enabled
- Preload API Bridge

---

# Future Improvements

- Barcode / QR Code Receipts
- Backup & Restore
- Multi-user Synchronization
- Automatic Database Backup
- SMS / Email Notifications
- Cloud Backup
- Digital Signature Support

---

# Screenshots

> Screenshots will be added soon.

---

# Author

**Earl John S. Obañana**

Computer Engineering Student  
Aspiring Full Stack Developer

GitHub:
https://github.com/earljohnobanana

---

# License

This project is licensed under the **MIT License**.
