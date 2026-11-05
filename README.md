# Bubbly Laundry Website

A laundry shop website where customers request laundry service online and the shop team manages orders, customers, services and payments from a private staff area.

Built with **JavaScript (Node.js and Express)**, **MySQL**, and plain HTML, CSS and JavaScript pages.

---

## What the website offers

### For customers
- Create an account and sign in
- Request a laundry service, choosing Pickup or Delivery and adding notes
- Follow each order's status, items and payments in **My Orders**
- See the shop's reason when a request is declined
- Cancel a request before the shop reviews it
- Edit your profile details
- Ask **Bubbo**, the chat helper, about your orders

### For the shop team
- Dashboard with a summary of the shop's activity
- Confirm or reject customer requests
- Create and track orders, add garment items, and update statuses
- Manage customers and the list of services and prices
- Record payments and see balances
- Superadmin only: add people, change roles, disable accounts and reset passwords

### Who can do what

| Role | Access |
|---|---|
| **Customer** | Own orders and profile only |
| **Staff** | Daily work: orders, requests, customers and payments. Cannot delete customers, orders or payments, and cannot add services |
| **Admin** | Everything operational, including prices and deletes |
| **Superadmin** | Everything an admin can do, plus the Staff accounts page |

---

## Private staff sign-in

Staff do not sign in on the public login page. They use one hidden address that is not linked from any page. When the server starts, it prints it in the console:

```
Staff sign-in (keep private): http://localhost:3000/s-xxxxxxxxxxxx
```

- Set your own address with `STAFF_LOGIN_PATH=/your-secret-door` in `.env`.
- After repeated wrong passwords, the account is locked for 15 minutes.
- The superadmin can sign in only from the shop computer or the shop's network (see `SUPERADMIN_ALLOWED_IPS` below).

---

## Getting started

### You need
- Node.js 18 or newer
- MySQL with phpMyAdmin (XAMPP works well)

### Steps

1. **Install the packages**
   ```
   npm install
   ```
2. **Create the database.** In phpMyAdmin, create a database named `db_laundry`, import the base schema file, then run `database/staff_migration.sql` (each numbered step on its own).
3. **Create a `.env` file** in the project root:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=db_laundry
   PORT=3000
   AUTH_SECRET=a-long-random-string
   ```
4. **Create the superadmin** (this can only be done in the terminal):
   ```
   node src/scripts/createStaff.js --role superadmin
   ```
5. **Start the website**
   ```
   npm run dev
   ```
6. Open `http://localhost:3000` for customers, or the private staff address printed in the console.

### Settings in `.env`

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `PORT` | Website port (default 3000) |
| `AUTH_SECRET` | Signs logins and generates the hidden staff address. Keep it set and private |
| `STAFF_LOGIN_PATH` | Optional fixed hidden address |
| `SUPERADMIN_ALLOWED_IPS` | Optional list of addresses the superadmin may sign in from (include `127.0.0.1` for the server computer) |
| `GROQ_API_KEY` | Optional, needed for the Bubbo chat helper |

Never commit `.env` to GitHub.

### Forgot a staff password?
```
node src/scripts/createStaff.js --reset someone@shop.ph "new-password"
```

---

## Project structure

```
public/        Website pages, styles and scripts
src/views/     Hidden staff sign-in page (not public)
src/routes/    Web address routes
src/controllers/  Request handling
src/models/    Database queries
src/utils/     Sign-in, access control and helper code
src/scripts/   Terminal tools (create staff, reset passwords)
database/      Database migration files
```

---

## For developers: API

The website talks to a JSON API under `/api`:

| Area | Address |
|---|---|
| Customers | `/api/customers` |
| Services | `/api/services` |
| Orders | `/api/orders` |
| Order items | `/api/order-items` |
| Payments | `/api/payments` |
| Customer portal | `/api/portal` |
| Staff accounts | `/api/staff` |

Full details are in Swagger: `http://localhost:3000/api-docs`

---
