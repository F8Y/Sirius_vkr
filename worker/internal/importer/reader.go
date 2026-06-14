package importer

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/xuri/excelize/v2"
)

// findEntityFile looks for "<base>.csv" then "<base>.xlsx" inside dir.
func findEntityFile(dir, base string) (string, bool) {
	for _, ext := range []string{".csv", ".xlsx"} {
		p := filepath.Join(dir, base+ext)
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			return p, true
		}
	}
	return "", false
}

// readRecords reads a CSV or XLSX file and returns each data row as a map keyed
// by the (lowercased, trimmed) header column name.
func readRecords(path string) ([]map[string]string, error) {
	var header []string
	var rows [][]string
	var err error

	switch strings.ToLower(filepath.Ext(path)) {
	case ".csv":
		header, rows, err = readCSV(path)
	case ".xlsx":
		header, rows, err = readXLSX(path)
	default:
		return nil, fmt.Errorf("unsupported file extension %q", filepath.Ext(path))
	}
	if err != nil {
		return nil, err
	}
	if len(header) == 0 {
		return nil, fmt.Errorf("file %q has no header row", filepath.Base(path))
	}

	idx := make(map[string]int, len(header))
	for i, h := range header {
		idx[strings.ToLower(strings.TrimSpace(h))] = i
	}

	records := make([]map[string]string, 0, len(rows))
	for _, r := range rows {
		rec := make(map[string]string, len(idx))
		for name, i := range idx {
			if i < len(r) {
				rec[name] = strings.TrimSpace(r[i])
			} else {
				rec[name] = ""
			}
		}
		records = append(records, rec)
	}
	return records, nil
}

func readCSV(path string) (header []string, rows [][]string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("open csv %q: %w", path, err)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1 // tolerate ragged rows; missing cells handled later
	all, err := reader.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("parse csv %q: %w", path, err)
	}
	if len(all) == 0 {
		return nil, nil, nil
	}
	return all[0], all[1:], nil
}

func readXLSX(path string) (header []string, rows [][]string, err error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return nil, nil, fmt.Errorf("open xlsx %q: %w", path, err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, nil, fmt.Errorf("xlsx %q has no sheets", path)
	}
	all, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, nil, fmt.Errorf("read xlsx %q: %w", path, err)
	}
	if len(all) == 0 {
		return nil, nil, nil
	}
	return all[0], all[1:], nil
}
