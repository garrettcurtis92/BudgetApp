# Ledger

A mobile-first household budget tracker built with Next.js and Supabase. Designed for real-world bill management — tracking income, scheduling payments, managing debt payoff, and following money through the month as paychecks arrive.

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Database:** Supabase (Postgres)
- **Styling:** Tailwind CSS with CSS custom properties for theming
- **Hosting:** Vercel

---

## Features

### Dashboard

The main view. All data is fetched server-side and hydrated into client components for live interactivity.

#### Live Income Tracking
- Log paychecks with amount, date, and optional note via the **Income Widget**
- Delete incorrect entries
- As paychecks are logged, three live metrics update instantly:
  - **Received This Month** — actual income logged so far
  - **Total Budgeted** — sum of all active budget categories
  - **Buffer** — received minus budgeted (shows shortfall if income hasn't fully arrived yet)
- Expected monthly total ($7,099.30) shown as sublabel for context

#### Coming Up Widget
- Shows all bills due within the next 7 days
- Color-coded urgency badges: **Today** / **Tomorrow** (red), **3 days** (amber), **4–7 days** (muted)
- Annual bills (Amazon Prime, MacroFactor) only appear in their due month
- Pulls `due_day`, `due_month`, and `frequency` from `budget_categories`

#### Pay Queue
A full bill management system for the month.

**Summary bar** — three columns at a glance:
- Received (from income log)
- Paid out (sum of bills marked paid this month)
- Remaining (received minus paid)

**Credit card sections (informational):**
- Alaska Card and Apple Card each have their own section
- Fixed charges (subscriptions, insurance, etc.) shown at budgeted amount
- Variable spending charged to the card (Groceries, Fuel, Blessing Fund, Discretionary) shown at **actual amount** if entered, or budgeted as an estimate (labelled)
- Running card total updates dynamically as actuals are entered in the Budget page
- Current debt balance shown in the card footer
- Annual bills (Amazon Prime) only appear in February

**Direct bills list:**
- All fixed bills not on a card, sorted by due date
- Debt payments (min + extra) grouped together under one checkbox — tap once to mark both paid
- Current debt balance shown inline on each group
- **Coverage dots** — once income is logged, green dot = that bill is covered by received income so far (running total top-to-bottom)
- Tap any bill or group to mark paid; tap again to unmark

**Automatic debt balance updates** when a payment is marked paid:
- **Direct loans (Tesla, Chase cards):** balance reduced by payment amount
- **Credit cards (Alaska Card, Apple Card):** full monthly cycle calculated:
  - Adds all charges to the card this month (fixed at budgeted + variable at actual)
  - Subtracts the payment
  - Net change applied to `debts.current_balance`
- Reversible — unmarking a payment reverses the balance change

---

### Budget Page

Monthly budget tracking with category actuals.

- **Month navigation** — browse any past or future month
- **Inline budget editing** — tap the pencil icon on any category to override the budgeted amount for just that month (stored in `budget_overrides`)
- **Tap to autofill** — tapping the budgeted amount auto-fills the actual input with that value (flashes green as feedback)
- **Variable rollover** — variable categories (Groceries, Fuel, etc.) carry unspent amounts into the next month
- **Search** — filter categories by name
- **Month reset** — two-tap confirm to clear all actuals and overrides for a month
- **Add expense** — add new budget categories from two entry points:
  - Small "+ Add" button next to the page title
  - Full form at the bottom of the category list
  - Fields: name, group, amount, variable toggle
- **Remove expense** — trash icon on each row (mobile: always visible; desktop: appears on hover). Two-tap confirm before deletion (sets `is_active = false`, preserving historical data)
- **Month summary** — total income, total budgeted, total actual spent, net remaining

---

### Debts Page

- Tracks all non-mortgage debts with current balance, APR, minimum payment, and extra payment
- Payment history with undo
- Apply Payment button with automatic principal calculation
- Auto-removes paid-off debts
- Debt balances update automatically when payments are marked in the Pay Queue

---

### Quick Add

Fast expense entry optimized for mobile use.

- Pill selector for common categories (Groceries, Fuel, Dining Out, Discretionary, Blessing Fund)
- Persistent amount input
- Adds directly to `monthly_actuals` for the current month

---

### Savings Page

Tracks savings goals with current balance and monthly contribution targets.

---

## Database Schema

### `budget_categories`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | |
| `group_name` | text | Fixed Expenses, Debts, Insurance & Giving, Subscriptions, Variable, Savings |
| `budgeted_amount` | numeric | Default monthly budget |
| `is_variable` | boolean | Enables rollover |
| `sort_order` | integer | Display order |
| `is_active` | boolean | Soft delete |
| `due_day` | integer | Day of month bill is due (1–31) |
| `due_month` | integer | For annual bills — which month |
| `frequency` | text | `monthly` or `annual` |
| `payment_method` | text | `direct`, `alaska_card`, `apple_card` |
| `linked_debt_id` | uuid | FK → `debts.id` — links payment categories to their debt record |

### `monthly_actuals`
Tracks what was actually spent per category per month. Used by budget page, pay queue (mark paid), and quick add.

### `budget_overrides`
Per-month budget overrides for a category (e.g. a one-off higher bill). Applied on top of `budgeted_amount`.

### `rollovers`
Carries variable category surplus into the following month.

### `debts`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | |
| `current_balance` | numeric | Updated automatically by Pay Queue |
| `apr` | numeric | |
| `min_payment` | numeric | |
| `extra_payment` | numeric | |
| `is_paid_off` | boolean | |
| `card_payment_method` | text | `alaska_card` or `apple_card` — flags credit card debts for full-cycle balance calc |

### `savings_goals`
Savings goals with target, current balance, and monthly contribution.

### `income_log`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `amount` | numeric | |
| `paid_on` | date | Used to filter by month |
| `note` | text | Optional label (e.g. "VA", "W2") |

---

## Payment Method Logic

Categories are tagged with `payment_method`:

- `direct` — paid straight from bank (default)
- `alaska_card` — auto-charges to Alaska Airlines BofA card each month
- `apple_card` — auto-charges to Apple Card each month

**Alaska Card charges:** Rock Harbor tithe, Pathway church, Amazon Prime (annual, February), Geico, Claude AI, Internet, Visible, Life insurance, MacroFactor (annual, October), Peacock, Groceries, Fuel, Blessing Fund, Discretionary

**Apple Card charges:** Empyre Fitness, Apple Watch installment, iPhone payment

When the Alaska or Apple Card payment groups are marked paid in the Pay Queue, the debt balance is recalculated as:
```
new_balance = current_balance + total_card_charges_this_month − payment_amount
```
Variable charges (Groceries, Fuel, Blessing Fund, Discretionary) use the actual amount entered in the Budget page, falling back to budgeted if not yet entered.

---

## Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Add your Supabase URL and anon key

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment

Deployed on Vercel. Push to `main` triggers a production deployment automatically.

Environment variables required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
