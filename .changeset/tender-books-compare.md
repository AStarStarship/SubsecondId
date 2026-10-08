---
"SubsecondId": minor
---

The timestamp bit pattern has uses a 128-bit uid where the Most-Significant Bits (MSB) are a 36-bit Unix second timestamp followed by a 22-bit sub-second spin ticker and 70-bit Cryptographically-Secure Generated-Upon-Boot Random Number (CSGUBRN):

```AsciiArt
 v--MSb                        128-bit SubsecondId                           LSb--v
+---------------------------------------------------------------------------+
| 36-bit seconds timestamp | 22-bit sub-second spin ticker | 70-bit CSGUBRN |
+---------------------------------------------------------------------------+
```

The x86 CPU doesn't have a sub-second timestamp so to work with SQL databases and most servers you need second timestamps. Added SubsecondIdBufferFromHex so users can give UIDs to clients in hex string format and parse from a hex string to a Buffer. I renamed SubsecondIdPrint to SubsecondIdToHex and SubsecondIdParse to SubsecondIdFromHex because that makes the nomenclature consistent.

The test got cleaned up via DRY.
