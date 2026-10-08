---
"SubsecondId": minor
---

We were getting a `TypeError: crypto.randomInt is not a function` error when trying to import the API. This was fixed by converting calls to `crypto.randomInt` to:

```TypeScript
// Generates a random number between 0 and 2^48.
export function CryptoRandomInt(min: number = 0, max: number = 0xffffffffffff) {
  return require('crypto').randomInt(min, max);
}
```
