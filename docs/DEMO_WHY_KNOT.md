# Why Knot Exclusive Rentals demo

Sales preview of Slipstack branded for [Why Knot Exclusive Rentals](https://www.whyknotexclusiverentals.com/) — Florida Keys boat rentals and private charters (Tavernier).

**Repo:** `mikemacmadeit/why-knot-exclusive-rentals-demo`

## Live preview (send to prospects)

| | |
|---|---|
| **URL** | https://why-knot-demo.netlify.app |
| **Admin** | https://why-knot-demo.netlify.app/admin/login |
| **Email** | `whyknot@demo.io` |
| **Password** | `SlipstackDemo2026!` |

Same credentials appear in **Admin → Team** after you sign in.

> Note: `https://why-knot-exclusive-rentals.netlify.app` is on a Netlify team this machine cannot deploy to. Use **why-knot-demo.netlify.app** until that site is transferred or redeployed from the owning account.

## Local

```bash
npm run dev
```

Pitch demos authorize `*@demo.io` Firebase users when `DEMO_PITCH_SITE=1` / `blockSearchIndexing` / tenantId ends in `-demo`.
