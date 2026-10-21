# Vendor Portal

Add a publisher once, then create ROs, POs and IOs for it in about a minute. Evolved from the first-draft `ro_dashboard_1.html`; all earlier publishers, ROs, numbering and settings carry over.

## Run it

Double-click **`index.html`**. No install and no build step. React and the PDF library are in `vendor/`; only the Google Fonts link needs internet, and it falls back gracefully.

Optional local server (PowerShell only, no Node or Python): `powershell -File serve.ps1` → http://localhost:5173

## Run the tests

Open **`tests/index.html`** (or http://localhost:5173/tests/index.html with the server running). It shows how many tests passed. The tests use a separate storage area, so your own data is never touched.

They cover money maths (CPM/CPC/CPL/fixed, discounts, GST split, rounding), document numbering, validation, the approval workflow and permissions, upgrading older data, reports, CSV and PDF building.

## What is where

```
index.html            script load order = dependency order
css/styles.css        design system
tests/                index.html + harness.js + tests.js
js/
  config/             currentUser.js (who is acting + test role), permissions.js (the roles table), constants.js
  utils/              finance.js (ALL money maths), workflow.js (statuses + who may do what), validation.js,
                      documentNumbering.js, summary.js (dashboard numbers), csv.js, search.js, formatting.js ...
  data/               models.js (record shapes), seed.js (sample data, flagged isDemo)
  services/           storage, audit, settings, file, publisher, campaign, document, pdf, report, migration, seed
  components/         shared pieces (tabs, menus, forms, order wizard, PDF preview ...)
  pages/              Dashboard, Publishers, Campaigns, Documents, Reports, Settings, Activity
  app.js              routes + shell
vendor/               react, react-dom, htm, jspdf, jspdf-autotable
```

Screens use `html\`…\`` (htm), JSX-like with no compile step.

## How data is stored

In **this browser only** (localStorage, plus IndexedDB for uploaded files). Colleagues do not see each other's data, and clearing browser data removes it. **Settings → Data and backup → Download backup** saves everything to a JSON file.

- Records are versioned (`meta.schemaVersion`). On start-up `migrationService` brings older records up to date. It never clears anything, and it saves an untouched copy of the old records under `backup_v1` before the first change.
- The services are the only code that touches storage. To move to Supabase/PostgreSQL, re-implement `publisherService`, `campaignService`, `documentService`, `auditService`, `settingsService` (and `fileService` for files). The screens do not change.

## Behaviour notes

- **Numbering**: permanent counter per document type and year (`RO-2026-001`), stored apart from the documents, never derived from list length. A number never changes when you edit, and is never reused.
- **History stays fixed**: each document keeps the publisher details, agency details and GST type it was created with. Changing a publisher, a campaign or Settings later does not change documents already created. (Editing a Draft refreshes them, because it is still being worked on.)
- **Workflow**: Draft → Pending Approval → Approved → Sent → Acknowledged → Completed, with Rejected (back to Draft) and Cancelled. Only Draft and Rejected documents can be edited. Every move records who, when, role and comment. A rejection needs a reason. Settings can switch approval off (Draft → Approved directly).
- **GST**: CGST + SGST when your state (first two digits of your GSTIN) matches the publisher's, IGST when not, one plain GST line when the publisher's state is unknown. It can be overridden per publisher and per order. Totals are added up in whole paise.
- **Roles** (Admin, Media Operations, Finance, Approver, Read Only) live in `js/config/permissions.js`. **They are enforced in the browser only.** With no server, anyone with the browser can change the test role in Settings, so do not rely on roles to protect sensitive data until real sign-in and a backend are added.
- **Bank details**: account numbers are masked everywhere; only Admin and Finance can reveal them, and they are left out of every report and PDF.
- **Sample data** is flagged `isDemo`; Settings can remove or restore it without touching real records.
- **PDF**: one builder for RO, PO and IO. Amounts print as `INR 1,77,000.00` because the built-in PDF font has no ₹ glyph. Drafts, pending, rejected and cancelled documents carry a faint diagonal marker.

## Extension points

| To do this… | Change this |
|---|---|
| **Add sign-in** | `currentUser.get()/actor()/role()` in `js/config/currentUser.js`. Everything else already reads from it. |
| **Use a shared database** | The `*Service.js` files (see above). |
| **Change who may do what** | The table in `js/config/permissions.js` and the moves in `js/utils/workflow.js`. |
| **Change agency details on the PDF** | Settings → Your agency. No code change. |
| **Add a pricing model** | `PRICING_MODELS` in `js/config/constants.js`. |
| **Add a report** | A builder in `js/services/reportService.js` and an entry in `REPORTS`. |
