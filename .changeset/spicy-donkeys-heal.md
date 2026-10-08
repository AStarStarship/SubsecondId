---
"SubsecondId": minor
---

Removed the code that imports the crypto module and used a function pointer to pass in the `crypto.randomInt` function in like so:

```JavaScript
const { randomInt } = require('crypto');
let [lsw_i, msw_i] = SubsecondIdNext(randomInt);
```
