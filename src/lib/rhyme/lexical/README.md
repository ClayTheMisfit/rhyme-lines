# Given-name lexical signal

`usGivenNames.json` is a generated, lower-cased set of names recorded in the
United States Social Security Administration national baby-name data
(1880–2016), intersected with the repository's CMUdict vocabulary. The source
snapshot was obtained from the CC0-licensed `us-baby-names@1.0.0` package; its
raw files reproduce the SSA national data.

The intersection keeps this client-side risk index small and relevant to words
the rhyme pipeline can pronounce. It is name **evidence**, not a blacklist:
strong ordinary-word corpus membership or provider part-of-speech plus modern
frequency evidence overrides it. The JSON array is sorted and loaded once into
a module-level `Set` for deterministic O(1) lookups.
