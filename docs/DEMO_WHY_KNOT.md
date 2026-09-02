# Why Knot Exclusive Rentals demo

Sales preview of Slipstack branded for [Why Knot Exclusive Rentals](https://www.whyknotexclusiverentals.com/) — Florida Keys boat rentals and private charters (Tavernier).

**Repo:** `mikemacmadeit/why-knot-exclusive-rentals-demo`  
**Do not** point their live domain here until they buy and we provision production.

## Live preview (send to prospects)

| | |
|---|---|
| **URL** | https://why-knot-exclusive-rentals.netlify.app |
| **Admin** | https://why-knot-exclusive-rentals.netlify.app/admin/login |
| **Email** | `whyknot@demo.io` |
| **Password** | `SlipstackDemo2026!` |

Same credentials are shown in **Admin → Team** on this demo site.

Do **not** use `wk@demo.io` — that address was never created in Firebase.

## Local

```bash
npm run dev
```

Open `/` for the marketing site and `/admin/login` for the backend.

Pitch demos authorize any `*@demo.io` Firebase user when this is a sales site (`DEMO_PITCH_SITE`, `blockSearchIndexing`, or tenantId ending in `-demo`).
