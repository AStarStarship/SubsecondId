---
"SubsecondId": major
---

v0.2 brings the hybrid 64-bit and 128-bit SubsecondId format and the Local LSubsecondId (LSubsecondId). It is fastest to search for database rows using 64-bit inode indexes and a binary search. The 64-bit SubsecondId, or SubsecondId64, uses a 32-bit seconds timestamp in the MSB, a 16-bit subsecond ticker, and a 16-bit source id in the LSB. This is sufficient for web services with fewer than 1024 threads, but will experience longer cold boot times as the number of servers grow. The 128-bit SubsecondId, or SubsecondId128, now uses a 33-bit seconds timestamp in the MSB, a 22-bit subsecond ticker, and a 73-bit source id.

The performance has been greatly improved over v0.1, which was written in a C++ style in JS. There are some very useful utilities for working with bits and hex.

There is finally a Jest unit test with four unit test modules, on for the Utilities, one for LSubsecondId, one for SubsecondId64, and one for SubsecondId128. Only 65% of the functions are tested, which may be adequate. The test tests cover random numbers in every conceivable bit range, rather than just some random numbers.

You can find our next milestone at <https://github.com/AStarStartup/SubsecondId/issues/44>
