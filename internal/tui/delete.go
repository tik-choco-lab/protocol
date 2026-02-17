package tui

import (
	"fmt"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
)

type DeleteMsg struct {
	Name string
	Err  error
}

func (m Model) deleteProtocol() tea.Cmd {
	if m.cursor >= len(m.protocols) {
		return nil
	}
	p := m.protocols[m.cursor]
	simplePath := filepath.Join(m.protocolsDir, p.Name+".yaml")
	strictPath := filepath.Join(filepath.Dir(m.protocolsDir), "strict", p.Name+".json")

	return func() tea.Msg {
		var errs []string
		if err := os.Remove(simplePath); err != nil && !os.IsNotExist(err) {
			errs = append(errs, fmt.Sprintf("simple: %v", err))
		}
		if err := os.Remove(strictPath); err != nil && !os.IsNotExist(err) {
			errs = append(errs, fmt.Sprintf("strict: %v", err))
		}
		if len(errs) > 0 {
			return DeleteMsg{Name: p.Name, Err: fmt.Errorf("%s", errs)}
		}
		return DeleteMsg{Name: p.Name}
	}
}
