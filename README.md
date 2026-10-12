# SmartEvent — Modules 12–17

A learning/demo implementation of payment simulation, coupons, event reviews, notifications, event search/filtering, and a polished React UI.

## Stack
- Backend: Python 3.10+, FastAPI, SQLAlchemy, SQLite, Pydantic
- Frontend: React + Vite
- Payments: simulated payment flow (no real money is charged)

## Run the backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Open http://127.0.0.1:8000/docs

## Run the frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the URL printed by Vite (usually http://localhost:5173).

## Demo flow
1. Open the frontend and browse/search events.
2. Use the checkout form to create a demo booking/payment.
3. Try coupon code `WELCOME10` (10% off; seeded automatically).
4. Submit a review using the demo user ID `1` after creating a successful booking for an event.
5. View notifications in the bell/history panel.

## Important notes
- This is a local educational demo. Payments are simulated; do not enter real card details.
- JWT authentication is not wired into this standalone add-on because it is intended to merge into your existing SmartEvent project. Connect these write endpoints to your existing JWT dependency before deployment. For production, use password hashing, token expiry/rotation, role/ownership checks, rate limits, HTTPS, migrations, and a real payment provider's server-side webhook verification.
- The demo uses a header `X-User-Id: 1` for simple user identity on selected endpoints, not as production authentication. Replace this with JWT dependency from your existing SmartEvent Phase 1/2 project.
- Existing Phase 1 schemas may differ. Merge the models/routes with your current project rather than blindly replacing your existing files.
