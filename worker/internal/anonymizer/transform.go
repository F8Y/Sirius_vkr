package anonymizer

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// birthBandSize is the width, in years, of the generalization band applied to
// birth dates during anonymization (e.g. 2011-09-04 → "2010-2014"). Wider bands
// merge more records into each equivalence class, raising k at the cost of
// precision.
const birthBandSize = 5

// hashOriginal returns a hex SHA-256 of the original plaintext. Stored in
// vault.pseudonym_map so the mapping can be verified without holding the
// plaintext itself.
func hashOriginal(plaintext string) string {
	sum := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(sum[:])
}

// newToken generates an opaque, collision-resistant pseudonym for a field. The
// field tag (e.g. "eml", "nm") keeps tokens human-distinguishable in output
// while carrying no information about the original value.
func newToken(tag string) (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return fmt.Sprintf("%s_%s", tag, hex.EncodeToString(buf)), nil
}

// maskEmail reduces an email to a non-identifying shape: first character of the
// local part, the rest of the address hidden, only the TLD kept.
//
//	ivan.petrov@example.ru → i***@***.ru
func maskEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return "***"
	}
	first := string([]rune(email[:at])[0])
	domain := email[at+1:]
	if dot := strings.LastIndex(domain, "."); dot >= 0 && dot < len(domain)-1 {
		return first + "***@***." + domain[dot+1:]
	}
	return first + "***@***"
}

// maskPhone reveals only the last two digits in a fixed Russian-format mask:
//
//	+7 (912) 345-67-89 → +7 9** *** ** 89
func maskPhone(phone string) string {
	var digits strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	d := digits.String()
	if len(d) < 2 {
		return "+7 9** *** ** **"
	}
	return "+7 9** *** ** " + d[len(d)-2:]
}

// generalizeBirth maps an exact date to its birthBandSize-year band label,
// e.g. 2011-09-04 → "2010-2014". This is the quasi-identifier generalization.
func generalizeBirth(t time.Time) string {
	start := t.Year() - (t.Year() % birthBandSize)
	return fmt.Sprintf("%d-%d", start, start+birthBandSize-1)
}

// deref returns the pointed-to string, or "" for a nil pointer.
func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
