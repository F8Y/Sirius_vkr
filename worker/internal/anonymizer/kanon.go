package anonymizer

// kThreshold is the project's k-anonymity target: every record must share its
// quasi-identifier combination with at least kThreshold-1 others (k >= 5).
const kThreshold = 5

// computeK groups records by their quasi-identifier key and returns the size of
// the smallest equivalence class (k), the number of distinct classes, and one
// key of minimal size. For an empty input k is 0.
//
// Each element of keys is the joined quasi-identifier value(s) of one record;
// records sharing a key are mutually indistinguishable.
func computeK(keys []string) (k, classes int, smallestKey string) {
	if len(keys) == 0 {
		return 0, 0, ""
	}
	counts := make(map[string]int, len(keys))
	for _, key := range keys {
		counts[key]++
	}
	k = -1
	for key, n := range counts {
		if k == -1 || n < k {
			k, smallestKey = n, key
		}
	}
	return k, len(counts), smallestKey
}

// kAnonReport builds a KAnonReport from the generalized quasi-identifier keys.
// quasiIdentifiers names the QI columns the keys were derived from.
func kAnonReport(quasiIdentifiers []string, keys []string) *KAnonReport {
	k, classes, smallest := computeK(keys)
	return &KAnonReport{
		QuasiIdentifiers:     quasiIdentifiers,
		K:                    k,
		Threshold:            kThreshold,
		Compliant:            k >= kThreshold,
		EquivalenceClasses:   classes,
		TotalRecords:         len(keys),
		SmallestClassExample: smallest,
	}
}
