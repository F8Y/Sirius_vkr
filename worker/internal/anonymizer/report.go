package anonymizer

// Report is the full de-identification result written to jobs.result.
//
// Exactly one of Pseudonymization / Anonymization is populated, matching Mode.
// KAnonymity is present whenever the dataset carries a quasi-identifier (the
// students' birth date); it is the core ВКР privacy metric.
type Report struct {
	Mode          string       `json:"mode"`
	Dataset       string       `json:"dataset"`
	InputRecords  int          `json:"input_records"`
	OutputRecords int          `json:"output_records"`
	OutputPath    string       `json:"output_path"`
	Pseudonymized *PseudoStats `json:"pseudonymization,omitempty"`
	Anonymized    *AnonStats   `json:"anonymization,omitempty"`
	KAnonymity    *KAnonReport `json:"k_anonymity,omitempty"`
	Notes         []string     `json:"notes,omitempty"`
}

// PseudoStats describes a reversible pseudonymization run.
type PseudoStats struct {
	FieldsTokenized []string `json:"fields_tokenized"`
	MappingsWritten int      `json:"mappings_written"`
	Reversible      bool     `json:"reversible"`
	// ReversibilityCheck is the result of a self-test that takes one emitted
	// token, looks it up in the vault, decrypts the source value and confirms
	// it matches the original — concrete proof the run is reversible.
	ReversibilityCheck string `json:"reversibility_check"`
}

// AnonStats describes an irreversible anonymization run. PseudonymMapWrites is
// recorded explicitly and must always be 0: anonymization keeps no reverse
// mapping, which is what makes it irreversible.
type AnonStats struct {
	DirectIdentifiersRemoved []string `json:"direct_identifiers_removed"`
	MaskedFields             []string `json:"masked_fields"`
	GeneralizedFields        []string `json:"generalized_fields"`
	PseudonymMapWrites       int      `json:"pseudonym_map_writes"`
}

// KAnonReport captures the k-anonymity measurement over the output.
//
// k is the size of the smallest equivalence class formed by the combination of
// quasi-identifiers. A release satisfies k-anonymity at threshold t when every
// record is indistinguishable from at least t-1 others, i.e. k >= t. The
// project target is t = 5.
type KAnonReport struct {
	QuasiIdentifiers   []string `json:"quasi_identifiers"`
	K                  int      `json:"k"`
	Threshold          int      `json:"threshold"`
	Compliant          bool     `json:"compliant"`
	EquivalenceClasses int      `json:"equivalence_classes"`
	TotalRecords       int      `json:"total_records"`
	// KBeforeGeneralization is k computed on the raw (exact) birth date, shown
	// alongside K to make the effect of generalization visible. Anonymize only.
	KBeforeGeneralization int `json:"k_before_generalization,omitempty"`
	// SmallestClassExample is one quasi-identifier combination of minimal size,
	// useful when explaining why k has the value it does.
	SmallestClassExample string `json:"smallest_class_example,omitempty"`
}
