package tui

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/tik-choco-lab/protocol/internal/model"
	"github.com/tik-choco-lab/protocol/internal/output/simple"
	"github.com/tik-choco-lab/protocol/internal/output/strict"
)

func (m *CreateModel) save() error {
	p := &model.Protocol{
		Name:     m.protocolName,
		Fields:   m.rootFields,
		Reliable: m.reliable,
		Ordered:  m.ordered,
	}
	p.ResolveBits()

	simpleDir := m.protocolsDir
	strictDir := filepath.Join(filepath.Dir(m.protocolsDir), "strict")

	if err := simple.Generate([]*model.Protocol{p}, simpleDir); err != nil {
		return fmt.Errorf("simple出力失敗: %w", err)
	}
	if err := strict.Generate([]*model.Protocol{p}, strictDir); err != nil {
		return fmt.Errorf("strict出力失敗: %w", err)
	}

	return nil
}

func (m *CreateModel) renderYAML() string {
	var sb strings.Builder
	sb.WriteString("struct:\n")
	for _, f := range m.rootFields {
		sb.WriteString(writeFieldYAML(f, initialIndent))
	}
	sb.WriteString(fmt.Sprintf("\nreliable: %v\n", m.reliable))
	sb.WriteString(fmt.Sprintf("ordered: %v\n", m.ordered))
	return sb.String()
}

func writeFieldYAML(f *model.Field, indent int) string {
	var sb strings.Builder
	prefix := strings.Repeat("  ", indent)

	if f.Enum != nil {
		sb.WriteString(fmt.Sprintf("%s%s:\n", prefix, f.Name))
		sb.WriteString(fmt.Sprintf("%s  enum:\n", prefix))
		for _, v := range f.Enum.Variants {
			sb.WriteString(fmt.Sprintf("%s    - %s\n", prefix, v))
		}
	} else if len(f.Children) > 0 {
		sb.WriteString(fmt.Sprintf("%s%s:\n", prefix, f.Name))
		for _, c := range f.Children {
			sb.WriteString(writeFieldYAML(c, indent+1))
		}
	} else {
		sb.WriteString(fmt.Sprintf("%s%s: %s\n", prefix, f.Name, f.Type))
	}
	return sb.String()
}
