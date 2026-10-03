---
name: ChargeFind filtered spatial search
description: Correctly combining optional station filters with ChargeFind's KD-tree top-K ranking.
---

Smart-search predicates and maximum-distance limits must participate in KD-tree traversal. Do not fetch the unfiltered nearest K stations and apply filters afterward.

**Why:** Post-filtering can return too few results or hide valid farther matches, because rejected unfiltered candidates already consumed the top-K slots. Radius limits can also bound far-branch traversal, while results still need Haversine ordering.

**How to apply:** When adding a supported dataset-backed filter, apply it before a station enters the candidate list; preserve the KD-tree and Haversine ranking, and use filter-aware regression cases against the full real dataset.