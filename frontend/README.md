# frontend

Next.js web app for StealthPay.

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/explorer` | Browse shielded transactions on-chain |
| `/playground` | Interactive shield / transfer / unshield UI |
| `/docs` | Integration guide and SDK reference |

## Commands

```bash
pnpm dev      # start dev server
pnpm build    # production build
pnpm start    # start production server
```

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- shadcn/ui + Radix UI
- RainbowKit + wagmi (wallet connection)
- ethers v6
- Three.js (`@react-three/fiber`) for 3D visuals
