# $XYNQ

The network is free to use, but coordinating it isn't free to run — RPC,
orchestrator hosting, and the canary infrastructure all cost money, and
contributors need a reason to keep their machines connected. $XYNQ is how those
costs are covered and that work is rewarded, without ads, data sales, or a
subscription. It launches on [pump.fun](https://pump.fun).

## Where the money comes from

pump.fun accrues **creator fees** to a vault as the token trades. The keeper
(`scripts/keeper.ts`) sweeps that vault on a schedule and routes it two ways:

```
        pump.fun creator fees
                 │
        keeper sweep (scheduled)
                 │
        ┌────────┴────────┐
        ▼                 ▼
  buy back & burn     public treasury
   (supply ↓)        (runs the network)
```

By default it's an even split, tunable with `KEEPER_BURN_SPLIT_BPS` (`5000` =
50/50). The burn side market-buys $XYNQ and sends it to the incinerator; the
treasury side funds infrastructure and contributor incentives.

## Staking

Holders can stake $XYNQ to back the network (`lib/onchain-staking.ts`). A portion
of treasury inflow is shared with stakers in proportion to their stake at each
epoch boundary, so the people funding the network share in its upside.

## What the token is *not*

It isn't a paywall. Chat stays free and account-free whether or not you ever
touch $XYNQ. The token sits underneath the network as its funding and incentive
layer — its only job is to keep the lights on and reward the GPUs that do the
work.
