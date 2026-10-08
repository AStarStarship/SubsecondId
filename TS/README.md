# SubsecondId

SubsecondId is a blazing fast 64-bit and 128-bit superset monotonically increasing UUID library with cryptographically-secure client-side number generator to optimize SQL-like primary key search, Postgres, hot-to-archive databases like [SubsecondDb Postgres Extension](https://github.com/AStarStarship/SubsecondDb), distributed systems, sharded SQL databases like PlanetScale, key-value stores like Redis, etc. SubsecondId is part of the [ASCII Data Specification](https://github.com/AStarStarship/Crabs). Please read [this ReadMe file on GitHub](https://github.com/AStarStarship/Crabs/blob/master/TS/) for the most up to date instructions.

![example workflow](https://github.com/AStarStarship/SubsecondId/actions/workflows/test.yml/badge.svg)

This is the TypeScript/JavaScript/NPM version. These are other versions:

* [C++/Crabs](https://github.com/AStarStarship/Crabs)
* [Python](https://github.com/AStarStarship/Crabs/blob/master/Python/)

## Bit Patterns

The authoritative bit layouts are in the [ASCII Crabs Clock spec](https://github.com/AStarStarship/Crabs). The
diagrams below match the implemented TypeScript.

### 64-bit Hot Unique Id (the primary key you mint)

```AsciiArt
 v--MSb (always 1)                                              LSb--v
+--------------------------------------------------------------------------+
| 1-bit MSb | 27-bit unsigned seconds | 8-bit subsecond ticker | 28-bit source id |
+--------------------------------------------------------------------------+
```

The 27-bit `seconds` field counts seconds elapsed from the start of the current
**4-year calendar window** (year floored to a multiple of 4), so it resets to 0 at
the top of each window (2024, 2028, 2032, ...) and stays sortable. The 28-bit
`source id` is the issuing server's stable identity (provenance / anti-fraud).
The 8-bit `ticker` (0..255) provides intra-second uniqueness and caps the mint
rate per server.

### 64-bit Cold Unique Id (archive form)

```AsciiArt
 v--MSb (0)                                                 LSb--v
+----------------------------------------------------------+
| 36-bit unsigned seconds | 28-bit subsecond ticker |     |
+----------------------------------------------------------+
```

A Hot id is converted to Cold before its 4-year window rolls over (the normal
archive path). Cold ids sort purely by time and carry no source id (provenance
lives in the record metadata).

### 64-bit Eternally Hot Anonymous Unique Id

```AsciiArt
 v--MSb (1, bits 35:34 = 0b11)                                LSb--v
+------------------------------------------------------------+
| 1-bit MSb | 27-bit unsigned seconds | 34-bit anonymous id |
+------------------------------------------------------------+
```

### 128-bit Universally Unique Id

```AsciiArt
 v--MSb                                                              LSb--v
+--------------------------------------------------------------------------+
| 36-bit unsigned seconds | 16-bit subsecond ticker | 76-bit random source |
+--------------------------------------------------------------------------+
```

## Common Design

There is no one format that is going to be perfect for everyone, so it's more important that it work for the most number of people possible without much waste, and be good enough that you may never need to upgrade your database. Generating random numbers at run-time is EXTREMELY expensive and will bring your server to it's knees. It's best if the system requesting a UUID was trustworthy, but it's a zero-trust environment world, so we need a clever way to protect against UUID hacking.

Ideally, we want conversion between hex TUID and UUID strings and timestamp, subsecond tick, and random source id must be as fast as possible, requiring the bit counts to be multiples of 4.

32-bit Unix seconds timestamps are the industry norm for disk storage and inode based SQL databases that use 64-bit primary keys. There isn't much use for humans to know time beyond the second level for database purpose so it's better to use subsecond ticker over a milliseconds timestamp which requires an expensive division instruction to convert back to 32-bit seconds timestamp 1/256 is 3.90625ms so it's good enough precision. Almost all data on the internet gets cold quickly and don't need multiple decade timestamps. The Subsecond ticker allows us to cap the number of SubsecondIds a thread can generate because database calls are expensive, and this helps prevent DoS attacks. If a thread has to generate more UUIDs per second there are multiple strategies to get more such a source id server or blockchain or generating another random number and possibly waiting for a resolved UID collision.

On the client's side you aren't going to save any noticeable amount of power when you generate a random number each time you generate a UUID. The problem is that we don't want the web server or database to have to generate these expensive random numbers, and you can't trust the client either.

## 64-bit design

To [optimize for SQL and other database searches](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-index-design-guide).

By using 27.5 bits we only lose a very small amount of the epoch seconds but because the timestamp is in the MSb, we can use the length of the string to determine if the id is packed contiguous IDs. 27.875 bits is `2^27 + 2^26`, which is 234,881,024, which has a 7.44 year timestamp epoch, and literally no one will have a webpage open that long, so it's okay if the primary key changes after half an epoch, not a single person would complain about that.

To generate random numbers you use double-precision floating-point math, so you will always result with a 52-bit mantissa, and 28-bit bits is half of that and provides 268M random numbers, so if an database operation must be redone with a new random id once a day it's not an issue, but we can also assign 28-bit UUIDs with a server. The 8-bit (64 value) sub-second ticker limits the number of database writes from each server.

### Design

When you query SQL rows you search by primary id. When you search through a key-value store like Redis the system will hash a string, search, and compare. When you shard an SQL database, you will use a 64-bit SQL database specific row index, and a 64-bit shard id. The vast majority of the time servers will not be generating large numbers of UUIDs per second. All web sites start off with one server that gets scaled vertically or horizontally to server more users, and as this server grows, the number of UUIDs generated per second will be very small, then grow.

## 128-bit SubsecondIds

## 128-bit Design

128-bit UUIDs are useful for distributed systems where we can't bother checking if the random number source id is unique, which is important when you have millions of threads, so we use a 78-bit random number because it's enough that the chance of a collision is exponentially less than the chance of a network error. SQL and other inode-based databases use a 64-bit primary key integer with a 32-bit Unix timestamp. Databases just can't take thousands of operations per second from thousands of threads.

When your website grows to a large number of users, you need to shard the database and use multiple SQL servers. When that the database is copied the autoincrement primary key isn't valid anymore. PlanetScale automatically shards the database to scale to more users, so this is why there are no foreign keys with PlanetScale. While you might be tempted to use UUID, it does not generate values that always increase (i.e. monotonically increasing), which is not good for doing binary searches with. Binary searches require monotonically increasing search indexes, and the SQL database engine uses the inode structure in your data drives to search for SQL table rows.

Another solution is to use [Universally Unique Lexicographically Sortable Identifier (USubsecondId)](https://github.com/ulid/spec), but it uses a 48-bit millisecond timestamp MSB and 80-byte random number in the LSB. There are two problems with this design approach. First is that the x86 CPU doesn't have a sub-second timestamp, so databases do not use them. This means that to translate the milliseconds to seconds when you want to work with the database and you will have to divide and multiple by 1000, which is slow and error prone. To get a sub-second timestamp on an x86 server will require a dedicated thread to do a spin clock with an inter-process pipe, which is complex and unnecessary. We want an approach that doesn't have to generate any random numbers at runtime and we work in seconds and it will work for almost everything for thousands of years.

128-bit SubsecondId (SubsecondId16) use a 33-bit Unix second timestamp in the Most-Significant Bits (MSB) followed by a 22-bit sub-second spin ticker and 73-bit Cryptographically-Secure Generated-Upon-Boot Random Number (CSGUBRN):

Statistically this means that when you have two web servers active, the probability that both servers generate the same random number is 7.12e-41%. If you had 1,000 servers running then the probability would be 1.06e-22%, which is a 1 in 9,444,732,965,739,290,427,392 chance. If you had 1,000,000 servers running, the probability would be 1.06e-16%, which is a 1 in 9,444,732,965,739,290 chance and is a 53-bit number. If there ever is actually is more than one server with the same source id, this means that the server will have to regenerate a 73-bit random source id upon boot, which will result in the first database write from that server to have to be performed one. This makes this bit pattern statistically acceptable to use for military and banking applications.

The 22-bit sub-second spin ticker caps out the number of calls you can make to per second to 2^22, which is 4,194,304. If you make more calls than this per second than the algorithm will spin wait until the next second and then reset the sub-second ticker. Assuming the upper limit of a normal computer, which is no more than 4,294,967,296Hz (4.3GHz) and just so happens to be 2^32 or 32-bits, making the math easy. This would give you about 1024 instructions between when you can call SubsecondId. Given not all CPU instructions are single-cycle, you're usually waiting for memory, and you're going to be creating a data structure, it's highly unlikely you'll ever hit this cap and if you ever did you'll probably have no problem with the delay. This is an edge case.

The 36-bit timestamp has an epoch span of 2,177.6 years. By that time everything we know including your software and hardware will be long gone and forgotten. The above characteristics make the 22-bit spin ticker and 70-bit CSGUBRN a sweet spot that will work for almost every computer and last not be outdated for thousands of years.

The benefit of SubsecondId is that you don't need a naming server. You can use a 32-bit timestamp, a 22-bit sub-second ticker, and 10-bit server id if you use a naming server and that will give you an optimized 64-bit index, but each thread that uses SubsecondId will have to have it's own source, so you can quickly run out of source ids.

To [optimize for SQL and other database searches](https://learn.microsoft.com/en-us/sql/relational-databases/sql-server-index-design-guide), we need to take advantage of the 64-bit index in the inode data structure used by all in-disk database engines. Indexing can be very complicated and you can index your database tables different ways at runtime to optimize your lookups. You don't just want to XOR the SubsecondId LSW and MSW together because you'll get clustering, the result will be non-monotonic, and as the database grows you will get collisions. For this reason it's better to create new database rows using 128-indexes that you then index contiguously.

For users of your websites using SubsecondId, they will get HTML where the items with SubsecondIds will show up with an HTML property uid that will be a string. When this string is 32-characters long (in hex so that is 16-bytes) that means it's a 128-bit SubsecondId that has not been compacted to a 64-bit UID. In the OS filesystem, inodes have timestamps, so when you see these 32-character UIDs you will need to extract the seconds from the timestamp and search for the database row by timestamp and UID.

## Quickstart

The package is **dual CJS/ESM** — it loads under both `require()` (CommonJS,
including Jest) and `import` (ESM, including Next.js and browsers). No
`"type": "module"` gymnastics required on your side.

**1.** Install:

```BASH
npm install @astarship/subsecond-id
```

**2.** Import (ESM):

```TypeScript
import {
  SsIdSetSource, SsIdNext, SsIdNextHex,
  SsIdUnpack, SsIdTimestamp, SsIdTicker, SsIdSource, SsIdMsb,
  SsIdWindowStart, SsIdWindowCount,
} from '@astarship/subsecond-id'
```

**2b.** Import (CommonJS):

```JavaScript
const {
  SsIdSetSource, SsIdNext, SsIdNextHex,
  SsIdUnpack, SsIdTimestamp, SsIdTicker, SsIdSource, SsIdMsb,
  SsIdWindowStart, SsIdWindowCount,
} = require('@astarship/subsecond-id')
```

**3.** Configure your server's identity (call once at startup).

The 28-bit **source id** is a stable per-server identity that is embedded in
every id you mint — it is your anti-fraud provenance (from the id alone you can
tell which server produced a record). Derive it from a secret so the same server
always mints with the same identity, and an attacker without the secret cannot
forge that server's ids:

```TypeScript
import { createHash } from 'node:crypto'

// 28-bit stable server identity from a secret (env / config / file).
function serverIdFromSecret(secret: string): number {
  return createHash('sha256').update(secret).digest().readUInt32BE(0) >>> 4
}

SsIdSetSource(serverIdFromSecret(process.env.SUBSECOND_SERVER_ID!))
```

**4.** Add to your Drizzle schema (Postgres example). The 64-bit value is the
`bigint` primary key — the fastest SQL lookup — and doubles as a
self-authenticating timestamp.

```TypeScript
import { bigint, pgTable } from 'drizzle-orm/pg-core'

export const CourtCases = pgTable('court_cases', {
  uidx: bigint('uidx').primaryKey(),   // the 64-bit SubsecondId
})
```

**5.** Mint and store (TypeScript, Postgres):

```TypeScript
// Mint the next id. No RNG argument needed — the source identity is
// configured via SsIdSetSource() and the timestamp/ticker are derived from the
// system clock, so there is no expensive random-number generation per call.
const uidx = SsIdNext()                 // bigint
const uidxHex = uidx.toString(16).padStart(16, '0')   // 16-char hex (or SsIdNextHex())

// Inspect the embedded fields (provenance + time):
const [windowSeconds, ticker, source] = SsIdUnpack(uidx)
const absoluteSeconds = windowSeconds + SsIdWindowStart()  // ~filing time

await db.insert(CourtCases).values({ uidx })

// Look up by primary key (the whole point of a 64-bit index):
const row = await db.select().from(CourtCases).where(eq(CourtCases.uidx, uidx))
```

### The 4-year window

The 27-bit `seconds` field is **not** absolute Unix time. It counts seconds
elapsed from the start of the current **4-year calendar window** (year floored
to a multiple of 4: 2024, 2028, 2032, ...), and resets to 0 at the top of each
window. That is what makes a 27-bit field sortable and time-ordered. Recover the
absolute filing time with `SsIdTimestamp(id) + SsIdWindowStart()`; use
`SsIdWindowCount()` to tell which 4-year window an id belongs to (needed only
when an id outlives its window, e.g. for archival).

### 64-bit Local SubsecondId (no source)

For client-side UIDs / React refs that never touch a database, use the 64-bit
**Local** id — same monotonic design but no source id field, so no server
identity is needed:

```TypeScript
import { SsLIdNextHex } from '@astarship/subsecond-id'

const ExampleItems = ['Foo', 'Bar']
export function ExampleList() {
  return <ul>{ExampleItems.map((item) =>
    <li key={SsLIdNextHex()}>{item}</li>
  )}</ul>
}
```

### 128-bit Universally Unique Id

For distributed systems with many threads where checking source uniqueness is
too expensive, use the 128-bit `SsUId` (36-bit seconds + 16-bit ticker +
76-bit random source). It mints without a naming server:

```TypeScript
import { SsUIdNextHex, SsUIdSourceNext } from '@astarship/subsecond-id'

SsUIdSourceNext()        // (re)roll this server's 76-bit source id
const uid128 = SsUIdNextHex()   // 32-char hex string
```

## License

Copyright [AStarship](https://astarship.net); rights reserved under the PostgreSQL License.

Portions Copyright (c) 1996-2024, The PostgreSQL Global Development Group

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
