package tui

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/tik-choco-lab/protocol/internal/model"
)

func (m *CreateModel) View(width int) string {
	var sb strings.Builder

	header := titleStyle.Render(" ✨ 新規プロトコル作成 ")
	sb.WriteString(header)
	sb.WriteString("\n\n")

	steps := []string{"名前", "フィールド", "Reliable", "Ordered", "確認"}
	stepIdx := m.getCurrentStepIndex()

	sb.WriteString("  ")
	for i, s := range steps {
		if i == stepIdx {
			sb.WriteString(lipgloss.NewStyle().
				Bold(true).
				Foreground(lipgloss.Color("#FFFFFF")).
				Background(colorPrimary).
				Padding(0, 1).
				Render(fmt.Sprintf("%d. %s", i+1, s)))
		} else if i < stepIdx {
			sb.WriteString(lipgloss.NewStyle().
				Foreground(colorSuccess).
				Render(fmt.Sprintf(" ✓ %s ", s)))
		} else {
			sb.WriteString(dimStyle.Render(fmt.Sprintf(" %d. %s ", i+1, s)))
		}
		if i < len(steps)-1 {
			sb.WriteString(dimStyle.Render(" → "))
		}
	}
	sb.WriteString("\n\n")

	views := map[createStep]func() string{
		createStepName:        m.viewName,
		createStepFieldName:   m.viewFieldName,
		createStepFieldType:   m.viewFieldType,
		createStepEnumVariant: m.viewEnumVariant,
		createStepReliable:    m.viewReliable,
		createStepOrdered:     m.viewOrdered,
		createStepConfirm:     m.viewConfirm,
	}

	if view, ok := views[m.step]; ok {
		sb.WriteString(view())
	}

	if m.errMsg != "" {
		sb.WriteString("\n")
		errStyle := lipgloss.NewStyle().Foreground(colorDanger).Bold(true)
		sb.WriteString("  " + errStyle.Render("⚠ "+m.errMsg))
		sb.WriteString("\n")
	}

	return sb.String()
}

func (m *CreateModel) getCurrentStepIndex() int {
	switch m.step {
	case createStepName:
		return 0
	case createStepFieldName, createStepFieldType, createStepEnumVariant:
		return 1
	case createStepReliable:
		return 2
	case createStepOrdered:
		return 3
	case createStepConfirm:
		return 4
	}
	return 0
}

func (m *CreateModel) viewName() string {
	var sb strings.Builder
	sb.WriteString(subtitleStyle.Render("  プロトコル名を入力:"))
	sb.WriteString("\n\n")
	sb.WriteString("  " + m.textInput.View())
	sb.WriteString("\n\n")
	sb.WriteString(helpStyle.Render(dimStyle.Render("enter 確定  │  esc キャンセル")))
	return sb.String()
}

func (m *CreateModel) viewFieldName() string {
	var sb strings.Builder

	if len(m.fieldStack) > 0 {
		breadcrumb := lipgloss.NewStyle().Foreground(colorAccent).Bold(true).
			Render("  📂 " + m.breadcrumb())
		sb.WriteString(breadcrumb)
		sb.WriteString("\n\n")
	}

	fields := m.currentFields()
	if len(*fields) > 0 {
		sb.WriteString(subtitleStyle.Render("  追加済みフィールド:"))
		sb.WriteString("\n")
		for _, f := range *fields {
			sb.WriteString(renderFieldTree(f, treeIndent))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(subtitleStyle.Render("  フィールド名を入力:"))
	sb.WriteString("\n\n")
	sb.WriteString("  " + m.textInput.View())
	sb.WriteString("\n\n")

	hint := "enter 確定  │  空enter フィールド追加終了"
	if len(m.fieldStack) > 0 {
		hint = "enter 確定  │  空enter struct終了  │  esc 親に戻る"
	}
	sb.WriteString(helpStyle.Render(dimStyle.Render(hint)))
	return sb.String()
}

func (m *CreateModel) viewFieldType() string {
	var sb strings.Builder

	fieldName := m.textInput.Value()
	sb.WriteString(subtitleStyle.Render(fmt.Sprintf("  '%s' の型を選択:", fieldName)))
	sb.WriteString("\n\n")

	for i, opt := range typeOptions {
		if strings.HasPrefix(opt, "──") {
			sb.WriteString(dimStyle.Render("\n    " + opt))
			sb.WriteString("\n")
			continue
		}
		if i == m.typeCursor {
			sb.WriteString(selectedStyle.Render("  ▸ " + opt))
		} else {
			sb.WriteString(itemStyle.Render("    " + opt))
		}
		if info, ok := model.KnownTypes[opt]; ok {
			rangeInfo := fmt.Sprintf("  %d bits", info.Bits)
			if info.Name != "bool" {
				rangeInfo += fmt.Sprintf("  [%s → %s]", info.MinValue, info.MaxValue)
			}
			sb.WriteString(dimStyle.Render(rangeInfo))
		}
		sb.WriteString("\n")
	}
	sb.WriteString("\n")
	sb.WriteString(helpStyle.Render(dimStyle.Render("↑/↓ 選択  │  enter 確定  │  esc 戻る")))
	return sb.String()
}

func (m *CreateModel) viewEnumVariant() string {
	var sb strings.Builder

	sb.WriteString(subtitleStyle.Render(fmt.Sprintf("  '%s' のenum variant を入力:", m.currentFieldName)))
	sb.WriteString("\n\n")

	if len(m.currentEnumVariants) > 0 {
		for i, v := range m.currentEnumVariants {
			sb.WriteString(fmt.Sprintf("    %s %d: %s\n",
				lipgloss.NewStyle().Foreground(colorAccent).Render("│"),
				i, v))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("  " + m.textInput.View())
	sb.WriteString("\n\n")
	sb.WriteString(helpStyle.Render(dimStyle.Render("enter 追加  │  空enter 入力終了  │  esc キャンセル")))
	return sb.String()
}

func (m *CreateModel) viewReliable() string {
	var sb strings.Builder
	sb.WriteString(subtitleStyle.Render("  Reliable (信頼性保証):"))
	sb.WriteString("\n\n")
	sb.WriteString(renderToggle(m.reliable, "true", "false"))
	sb.WriteString("\n\n")
	sb.WriteString(helpStyle.Render(dimStyle.Render("←/→ 切替  │  enter 確定  │  esc 戻る")))
	return sb.String()
}

func (m *CreateModel) viewOrdered() string {
	var sb strings.Builder
	sb.WriteString(subtitleStyle.Render("  Ordered (順序保証):"))
	sb.WriteString("\n\n")
	sb.WriteString(renderToggle(m.ordered, "true", "false"))
	sb.WriteString("\n\n")
	sb.WriteString(helpStyle.Render(dimStyle.Render("←/→ 切替  │  enter 確定  │  esc 戻る")))
	return sb.String()
}

func (m *CreateModel) viewConfirm() string {
	var sb strings.Builder
	sb.WriteString(subtitleStyle.Render("  プレビュー:"))
	sb.WriteString("\n\n")

	yaml := m.renderYAML()
	previewStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(colorBorder).
		Padding(0, 1).
		Foreground(colorText)
	sb.WriteString(previewStyle.Render(yaml))
	sb.WriteString("\n\n")

	simplePath := filepath.Join(m.protocolsDir, m.protocolName+".yaml")
	strictPath := filepath.Join(filepath.Dir(m.protocolsDir), "strict", m.protocolName+".json")

	pathLabel := lipgloss.NewStyle().Foreground(colorSecondary).Bold(true)
	sb.WriteString(subtitleStyle.Render("  出力先:"))
	sb.WriteString("\n")
	sb.WriteString(fmt.Sprintf("    %s  %s\n", pathLabel.Render("simple"), dimStyle.Render(simplePath)))
	sb.WriteString(fmt.Sprintf("    %s  %s\n", pathLabel.Render("strict"), dimStyle.Render(strictPath)))

	sb.WriteString("\n\n")
	sb.WriteString(helpStyle.Render(dimStyle.Render("enter/y 保存  │  esc/n キャンセル")))
	return sb.String()
}

func renderToggle(value bool, onLabel, offLabel string) string {
	onStyle := lipgloss.NewStyle().Padding(0, togglePadding)
	offStyle := lipgloss.NewStyle().Padding(0, togglePadding)

	if value {
		onStyle = onStyle.Background(colorSuccess).Foreground(lipgloss.Color("#FFFFFF")).Bold(true)
		offStyle = offStyle.Foreground(colorTextDim)
	} else {
		onStyle = onStyle.Foreground(colorTextDim)
		offStyle = offStyle.Background(colorDanger).Foreground(lipgloss.Color("#FFFFFF")).Bold(true)
	}

	return "    " + onStyle.Render(onLabel) + "  " + offStyle.Render(offLabel)
}

func renderFieldTree(f *model.Field, indent int) string {
	var sb strings.Builder
	prefix := strings.Repeat("  ", indent)
	icon := lipgloss.NewStyle().Foreground(colorSecondary).Render("●")
	typeStyle := lipgloss.NewStyle().Foreground(colorAccent)

	if f.Enum != nil {
		sb.WriteString(fmt.Sprintf("%s%s %s: %s [%s]\n", prefix, icon, f.Name,
			typeStyle.Render("enum"),
			strings.Join(f.Enum.Variants, ", ")))
	} else if len(f.Children) > 0 {
		sb.WriteString(fmt.Sprintf("%s%s %s: %s\n", prefix, icon, f.Name,
			typeStyle.Render("struct")))
		for _, c := range f.Children {
			sb.WriteString(renderFieldTree(c, indent+1))
		}
	} else {
		sb.WriteString(fmt.Sprintf("%s%s %s: %s\n", prefix, icon, f.Name,
			typeStyle.Render(f.Type)))
	}
	return sb.String()
}
