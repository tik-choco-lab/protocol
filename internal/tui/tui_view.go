package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/tik-choco-lab/protocol/internal/model"
)

func (m Model) View() string {
	if !m.ready {
		return "Initializing..."
	}

	switch m.mode {
	case viewList:
		return m.viewList()
	case viewSimple, viewStrict:
		return m.viewDetail()
	case viewCreate:
		if m.createModel != nil {
			return m.createModel.View(m.width)
		}
	case viewDelete:
		return m.viewDeleteConfirm()
	}
	return ""
}

func (m Model) viewList() string {
	var sb strings.Builder

	header := titleStyle.Render(" 📦 Protocol Manager ")
	sb.WriteString(header)
	sb.WriteString("\n")
	sb.WriteString(dimStyle.Render(fmt.Sprintf("  %d protocols loaded from %s", len(m.protocols), m.protocolsDir)))
	sb.WriteString("\n\n")

	tableHeader := fmt.Sprintf("  %-4s %-25s %-7s %-14s %-10s %s",
		headerStyle.Render("ID"),
		headerStyle.Render("Name"),
		headerStyle.Render("Bits"),
		headerStyle.Render("Bytes"),
		headerStyle.Render("Reliable"),
		headerStyle.Render("Ordered"))
	sb.WriteString(tableHeader)
	sb.WriteString("\n")
	sb.WriteString(dimStyle.Render("  " + strings.Repeat("─", borderLineWidth)))
	sb.WriteString("\n")

	for i, p := range m.protocols {
		rel := tagReliable.Render("● reliable")
		if !p.Reliable {
			rel = tagUnreliable.Render("○ unreliable")
		}
		ord := tagOrdered.Render("● ordered")
		if !p.Ordered {
			ord = tagUnordered.Render("○ unordered")
		}

		line := fmt.Sprintf("0x%04X %-25s %-7d %-14d %s  %s",
			p.PacketID, p.Name, p.TotalBits, p.TotalBytes(), rel, ord)

		if i == m.cursor {
			sb.WriteString(selectedStyle.Render("▸ " + line))
		} else {
			sb.WriteString(itemStyle.Render("  " + line))
		}
		sb.WriteString("\n")
	}

	if m.genMsg != "" {
		sb.WriteString("\n")
		sb.WriteString("  " + m.genMsg)
		sb.WriteString("\n")
	}

	help := []string{
		"↑/↓ navigate",
		"a add new",
		"x delete",
		"s simple view",
		"d strict view",
		"g generate files",
		"q quit",
	}
	sb.WriteString(helpStyle.Render(dimStyle.Render(strings.Join(help, "  │  "))))

	return sb.String()
}

func (m Model) viewDetail() string {
	var sb strings.Builder

	modeStr := "Simple"
	modeColor := colorSuccess
	if m.mode == viewStrict {
		modeStr = "Strict"
		modeColor = colorAccent
	}

	header := titleStyle.Render(" 📦 Protocol Manager ")
	modeTag := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FFFFFF")).
		Background(modeColor).
		Padding(0, 1).
		Render(modeStr)

	sb.WriteString(header + "  " + modeTag)
	sb.WriteString("\n")

	if m.cursor < len(m.protocols) {
		sb.WriteString(viewportHeaderStyle.Render("▸ " + m.protocols[m.cursor].Name))
	} else {
		sb.WriteString(viewportHeaderStyle.Render("▸ All Protocols"))
	}
	sb.WriteString("\n\n")

	sb.WriteString(m.viewport.View())
	sb.WriteString("\n")

	help := []string{
		"↑/↓ scroll",
		"←/→ prev/next",
		"tab toggle type",
		"esc back",
		"q quit",
	}
	sb.WriteString(helpStyle.Render(dimStyle.Render(strings.Join(help, "  │  "))))

	return sb.String()
}

func (m Model) viewDeleteConfirm() string {
	var sb strings.Builder

	header := titleStyle.Render(" 🗑 プロトコル削除 ")
	sb.WriteString(header)
	sb.WriteString("\n\n")

	if m.cursor < len(m.protocols) {
		p := m.protocols[m.cursor]
		warnStyle := lipgloss.NewStyle().Foreground(colorDanger).Bold(true)
		sb.WriteString(warnStyle.Render(fmt.Sprintf("  '%s' の出力ファイルを削除しますか？", p.Name)))
		sb.WriteString("\n\n")

		sb.WriteString(dimStyle.Render(fmt.Sprintf("    simple: output/simple/%s.yaml", p.Name)))
		sb.WriteString("\n")
		sb.WriteString(dimStyle.Render(fmt.Sprintf("    strict: output/strict/%s.json", p.Name)))
		sb.WriteString("\n")
	}

	sb.WriteString("\n")
	sb.WriteString(helpStyle.Render(dimStyle.Render("y 削除  │  n/esc キャンセル")))

	return sb.String()
}

func Run(protocols []*model.Protocol, protocolsDir string) error {
	m := NewModel(protocols, protocolsDir)
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}
