package importer

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"sirius27/worker/internal/store"
)

var (
	uuidRe  = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

	relationTypes = map[string]bool{"mother": true, "father": true, "guardian": true}
)

// optStr returns nil for an empty value so the column is written as SQL NULL.
func optStr(v string) *string {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil
	}
	return &v
}

func optEmail(v string) (*string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil, nil
	}
	if !emailRe.MatchString(v) {
		return nil, fmt.Errorf("invalid email format: %q", v)
	}
	return &v, nil
}

func optPhone(v string) (*string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil, nil
	}
	digits := 0
	for _, r := range v {
		if r >= '0' && r <= '9' {
			digits++
		}
	}
	if digits < 10 {
		return nil, fmt.Errorf("invalid phone (need at least 10 digits): %q", v)
	}
	return &v, nil
}

func optDate(v string) (*time.Time, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", v)
	if err != nil {
		return nil, fmt.Errorf("invalid birth_date (expected YYYY-MM-DD): %q", v)
	}
	return &t, nil
}

func validateStudent(rec map[string]string) (*store.StudentRow, error) {
	id := strings.TrimSpace(rec["id"])
	if !uuidRe.MatchString(id) {
		return nil, fmt.Errorf("invalid or missing id")
	}
	last := strings.TrimSpace(rec["last_name"])
	if last == "" {
		return nil, fmt.Errorf("last_name is required")
	}
	first := strings.TrimSpace(rec["first_name"])
	if first == "" {
		return nil, fmt.Errorf("first_name is required")
	}
	email, err := optEmail(rec["email"])
	if err != nil {
		return nil, err
	}
	phone, err := optPhone(rec["phone"])
	if err != nil {
		return nil, err
	}
	birth, err := optDate(rec["birth_date"])
	if err != nil {
		return nil, err
	}
	return &store.StudentRow{
		ID:         id,
		LastName:   last,
		FirstName:  first,
		MiddleName: optStr(rec["middle_name"]),
		Email:      email,
		Phone:      phone,
		BirthDate:  birth,
	}, nil
}

func validateGuardian(rec map[string]string) (*store.GuardianRow, error) {
	id := strings.TrimSpace(rec["id"])
	if !uuidRe.MatchString(id) {
		return nil, fmt.Errorf("invalid or missing id")
	}
	last := strings.TrimSpace(rec["last_name"])
	if last == "" {
		return nil, fmt.Errorf("last_name is required")
	}
	first := strings.TrimSpace(rec["first_name"])
	if first == "" {
		return nil, fmt.Errorf("first_name is required")
	}
	rel := strings.ToLower(strings.TrimSpace(rec["relation_type"]))
	if !relationTypes[rel] {
		return nil, fmt.Errorf("invalid relation_type %q (expected mother/father/guardian)", rec["relation_type"])
	}
	email, err := optEmail(rec["email"])
	if err != nil {
		return nil, err
	}
	phone, err := optPhone(rec["phone"])
	if err != nil {
		return nil, err
	}
	return &store.GuardianRow{
		ID:           id,
		LastName:     last,
		FirstName:    first,
		MiddleName:   optStr(rec["middle_name"]),
		Email:        email,
		Phone:        phone,
		RelationType: rel,
	}, nil
}

func validateLink(rec map[string]string) (*store.LinkRow, error) {
	sid := strings.TrimSpace(rec["student_id"])
	if !uuidRe.MatchString(sid) {
		return nil, fmt.Errorf("invalid or missing student_id")
	}
	gid := strings.TrimSpace(rec["guardian_id"])
	if !uuidRe.MatchString(gid) {
		return nil, fmt.Errorf("invalid or missing guardian_id")
	}
	return &store.LinkRow{StudentID: sid, GuardianID: gid}, nil
}
