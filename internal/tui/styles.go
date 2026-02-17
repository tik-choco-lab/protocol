package tui

import "github.com/charmbracelet/lipgloss"

const (
	headerHeight    = 6
	footerHeight    = 3
	borderLineWidth = 75
	minViewportH    = 1
)

var (
	colorPrimary   = lipgloss.Color("#7C3AED")
	colorSecondary = lipgloss.Color("#06B6D4")
	colorAccent    = lipgloss.Color("#F59E0B")
	colorSuccess   = lipgloss.Color("#10B981")
	colorDanger    = lipgloss.Color("#EF4444")
	colorBg        = lipgloss.Color("#0F172A")
	colorBgLight   = lipgloss.Color("#1E293B")
	colorText      = lipgloss.Color("#E2E8F0")
	colorTextDim   = lipgloss.Color("#64748B")
	colorBorder    = lipgloss.Color("#334155")

	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(colorPrimary).
			Padding(0, 1)

	subtitleStyle = lipgloss.NewStyle().
			Foreground(colorSecondary).
			Bold(true)

	selectedStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(colorPrimary).
			Bold(true).
			Padding(0, 1)

	itemStyle = lipgloss.NewStyle().
			Foreground(colorText).
			Padding(0, 1)

	dimStyle = lipgloss.NewStyle().
			Foreground(colorTextDim)

	tagReliable = lipgloss.NewStyle().
			Foreground(colorSuccess).
			Bold(true)

	tagUnreliable = lipgloss.NewStyle().
			Foreground(colorDanger).
			Bold(true)

	tagOrdered = lipgloss.NewStyle().
			Foreground(colorSecondary).
			Bold(true)

	tagUnordered = lipgloss.NewStyle().
			Foreground(colorAccent).
			Bold(true)

	helpStyle = lipgloss.NewStyle().
			Foreground(colorTextDim).
			Padding(1, 0, 0, 2)

	borderStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorBorder).
			Padding(0, 1)

	headerStyle = lipgloss.NewStyle().
			Foreground(colorPrimary).
			Bold(true)

	viewportHeaderStyle = lipgloss.NewStyle().
				Foreground(colorAccent).
				Bold(true).
				PaddingLeft(2)
)
