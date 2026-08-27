# Why Knot Exclusive Rentals demo

Sales preview of Slipstack branded for [Why Knot Exclusive Rentals](https://www.whyknotexclusiverentals.com/) — Florida Keys boat rentals and private charters (Tavernier).

**Branch:** `demo/why-knot-exclusive-rentals`  
**Do not** point their live domain here until they buy and we provision production.

This is a **separate company** from Tahoe Wakebusters: separate branch, config, photos, and (when provisioned) Firebase, Netlify, Stripe, and operator login.

## Filled in

- Company, Tavernier Creek / Florida Keys, phone `(645) 242-1977`, demo email `hello@whyknotexclusiverentals.com`
- Wakebusters homepage chassis, Why Knot teal brand + public site photography under `public/photos/whyknot`
- Trips: Boat Rental, Fishing Charter, Sandbar & Snorkel (The Bougie Girl / Sea Fox)
- Demo sample rates (~$750–$1,250) — not live customer pricing
- Public reviews from their site (Google / Boatsetter / Getmyboat)

## Local

```bash
npm run dev
```

Open `/` for the marketing site and `/admin/login` for the backend (needs a **dedicated** Firebase project + an operator user — do not reuse Tahoe’s project).

Demo admin login (fake inbox, short on purpose): `wk@demo.io`

## Still needed for a sendable link

1. Dedicated GitHub repo + Netlify site (not whyknotexclusiverentals.com)
2. Dedicated Firebase project + seed + operator login for Why Knot (not Super Admin, not Tahoe)
3. Stripe test mode optional; no `DEMO_ACCESS_KEY` (mobile/IG must open)
4. `DEMO_PITCH_SITE=1` for noindex
5. Confirm live rates, boat capacities, and social profile URLs with the operator
