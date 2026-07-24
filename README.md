# VPA Recommendation Calculator

**Live tool:** [https://prasad-m-k.github.io/vpa-calc/](https://prasad-m-k.github.io/vpa-calc/)

An interactive calculator that reproduces the Vertical Pod Autoscaler's decay-weighted percentile math, the OOM bump override, and whether a recommendation actually fits your namespace's ResourceQuota and LimitRange, for both CPU and memory.

Built as a companion to two blog posts:

1. *What the VPA Recommender Is Actually Computing (And Why It Disagrees With You)*
2. *Getting Real Numbers Into the VPA Model: The Commands and Tools*

## What it does

- Walks through three sample datasets (a one-off spike, a recurring pattern, and a clean history before an OOM event) with plain-language explanations for each
- Computes the decay-weighted histogram and target percentile by hand, showing every intermediate weight so the math is checkable, not a black box
- Applies the OOM override on top of the histogram target, the same way VPA's real recommender does
- Checks the resulting recommendation against a namespace CPU or memory quota, a LimitRange max, and VPA's own `maxAllowed`, including memory or CPU already used by other pods in the same quota pool

## Running locally

```bash
npm install
npm run dev
```

## Deploying

```bash
npm run build
npm run deploy
```

This builds the app and pushes the output to the `gh-pages` branch, which GitHub Pages serves automatically from `https://prasad-m-k.github.io/vpa-calc/`.

## License

MIT. See [LICENSE](./LICENSE).

## Disclaimer
This is an independent, personal open-source project, developed entirely on my own time using my own equipment. It is not affiliated with, endorsed by, or built using any resources, tools, or confidential information belonging to any current or past employer. All opinions expressed are my own.

## Author

**Prasad MK** (Kameswara Prasad Mukkamala)
[github.com/prasad-m-k](https://github.com/prasad-m-k)
