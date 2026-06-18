package anonymizer

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
)

// writeCSV writes header + rows to path, creating parent directories as needed.
func writeCSV(path string, header []string, rows [][]string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create output file %q: %w", path, err)
	}
	defer f.Close()

	w := csv.NewWriter(f)
	if err := w.Write(header); err != nil {
		return fmt.Errorf("write header: %w", err)
	}
	if err := w.WriteAll(rows); err != nil {
		return fmt.Errorf("write rows: %w", err)
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return fmt.Errorf("flush csv: %w", err)
	}
	return nil
}
