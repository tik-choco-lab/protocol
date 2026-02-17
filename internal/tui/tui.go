package tui

import (
	"fmt"
	"path/filepath"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/tik-choco-lab/protocol/internal/model"
	"github.com/tik-choco-lab/protocol/internal/output/simple"
	"github.com/tik-choco-lab/protocol/internal/output/strict"
	"github.com/tik-choco-lab/protocol/internal/parser"
)

type viewMode int

const (
	viewList viewMode = iota
	viewSimple
	viewStrict
	viewCreate
	viewDelete
)

type Model struct {
	protocols    []*model.Protocol
	cursor       int
	mode         viewMode
	viewport     viewport.Model
	width        int
	height       int
	ready        bool
	generating   bool
	genMsg       string
	protocolsDir string
	createModel  *CreateModel
}

type GenerateMsg struct {
	Mode string
	Err  error
}

type ReloadMsg struct {
	Protocols []*model.Protocol
	Err       error
}

func NewModel(protocols []*model.Protocol, protocolsDir string) Model {
	return Model{
		protocols:    protocols,
		protocolsDir: protocolsDir,
	}
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if m.mode == viewCreate && m.createModel != nil {
		return m.handleCreateUpdate(msg)
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		return m.handleWindowSize(msg)
	case GenerateMsg:
		return m.handleGenerateMsg(msg)
	case ReloadMsg:
		return m.handleReloadMsg(msg)
	case DeleteMsg:
		return m.handleDeleteMsg(msg)
	case tea.KeyMsg:
		m.genMsg = ""
		switch m.mode {
		case viewList:
			return m.updateList(msg)
		case viewSimple, viewStrict:
			return m.updateDetail(msg)
		case viewDelete:
			return m.updateDeleteConfirm(msg)
		}
	}

	return m, nil
}

func (m Model) handleCreateUpdate(msg tea.Msg) (tea.Model, tea.Cmd) {
	keyMsg, isKey := msg.(tea.KeyMsg)
	if isKey && keyMsg.String() == "ctrl+c" {
		return m, tea.Quit
	}

	if isKey {
		stepCmd := m.createModel.Update(keyMsg)
		if m.createModel.done {
			if m.createModel.saved {
				m.mode = viewList
				m.genMsg = "✅ プロトコルを出力しました"
				m.createModel = nil
				return m, m.reloadProtocols()
			}
			m.mode = viewList
			m.createModel = nil
			m.genMsg = ""
			return m, nil
		}
		tiCmd := m.createModel.UpdateTextInput(keyMsg)
		return m, tea.Batch(stepCmd, tiCmd)
	}

	cmd := m.createModel.UpdateTextInput(msg)
	return m, cmd
}

func (m Model) handleWindowSize(msg tea.WindowSizeMsg) (tea.Model, tea.Cmd) {
	m.width = msg.Width
	m.height = msg.Height

	vpHeight := m.height - headerHeight - footerHeight
	if vpHeight < minViewportH {
		vpHeight = minViewportH
	}

	if !m.ready {
		m.viewport = viewport.New(m.width, vpHeight)
		m.ready = true
	} else {
		m.viewport.Width = m.width
		m.viewport.Height = vpHeight
	}
	return m, nil
}

func (m Model) handleGenerateMsg(msg GenerateMsg) (tea.Model, tea.Cmd) {
	m.generating = false
	if msg.Err != nil {
		m.genMsg = fmt.Sprintf("❌ Error generating %s: %v", msg.Mode, msg.Err)
	} else {
		m.genMsg = fmt.Sprintf("✅ Generated %s output successfully!", msg.Mode)
	}
	return m, nil
}

func (m Model) handleReloadMsg(msg ReloadMsg) (tea.Model, tea.Cmd) {
	if msg.Err != nil {
		m.genMsg = fmt.Sprintf("❌ リロードエラー: %v", msg.Err)
	} else {
		m.protocols = msg.Protocols
		m.genMsg = fmt.Sprintf("✅ プロトコルを更新しました (%d 件)", len(msg.Protocols))
		if m.cursor >= len(m.protocols) {
			m.cursor = len(m.protocols) - 1
		}
		if m.cursor < 0 && len(m.protocols) > 0 {
			m.cursor = 0
		}
		return m, m.generateAll()
	}
	m.mode = viewList
	m.createModel = nil
	return m, nil
}

func (m Model) handleDeleteMsg(msg DeleteMsg) (tea.Model, tea.Cmd) {
	if msg.Err != nil {
		m.genMsg = fmt.Sprintf("❌ 削除エラー: %v", msg.Err)
		m.mode = viewList
		return m, nil
	} else {
		m.genMsg = fmt.Sprintf("✅ '%s' の出力ファイルを削除しました", msg.Name)
		m.mode = viewList
		return m, m.reloadProtocols()
	}
}

func (m Model) updateList(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "q", "ctrl+c":
		return m, tea.Quit
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
	case "down", "j":
		if m.cursor < len(m.protocols)-1 {
			m.cursor++
		}
	case "a":
		cm := NewCreateModel(m.protocolsDir)
		m.createModel = &cm
		m.mode = viewCreate
	case "e":
		if len(m.protocols) > 0 {
			cm := NewEditModel(m.protocols[m.cursor], m.protocolsDir)
			m.createModel = &cm
			m.mode = viewCreate
		}
	case "x":
		if len(m.protocols) > 0 {
			m.mode = viewDelete
		}
	case "s":
		m.mode = viewSimple
		m.viewport.SetContent(simple.RenderPreview(m.protocols[m.cursor]))
		m.viewport.GotoTop()
	case "d":
		m.mode = viewStrict
		m.viewport.SetContent(strict.RenderPreview(m.protocols[m.cursor]))
		m.viewport.GotoTop()
	case "S":
		m.mode = viewSimple
		m.viewport.SetContent(simple.RenderAllPreview(m.protocols))
		m.viewport.GotoTop()
	case "D":
		m.mode = viewStrict
		m.viewport.SetContent(strict.RenderAllPreview(m.protocols))
		m.viewport.GotoTop()
	case "g":
		if !m.generating {
			m.generating = true
			m.genMsg = "⏳ Generating output files..."
			return m, m.generateAll()
		}
	}
	return m, nil
}

func (m Model) updateDetail(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "q", "ctrl+c":
		return m, tea.Quit
	case "esc", "backspace":
		m.mode = viewList
		return m, nil
	case "left", "h":
		if m.cursor > 0 {
			m.cursor--
			m.refreshDetailView()
		}
		return m, nil
	case "right", "l":
		if m.cursor < len(m.protocols)-1 {
			m.cursor++
			m.refreshDetailView()
		}
		return m, nil
	case "tab":
		if m.mode == viewSimple {
			m.mode = viewStrict
		} else {
			m.mode = viewSimple
		}
		m.refreshDetailView()
		return m, nil
	default:
		var cmd tea.Cmd
		m.viewport, cmd = m.viewport.Update(msg)
		return m, cmd
	}
}

func (m *Model) refreshDetailView() {
	var content string
	p := m.protocols[m.cursor]
	if m.mode == viewSimple {
		content = simple.RenderPreview(p)
	} else {
		content = strict.RenderPreview(p)
	}
	m.viewport.SetContent(content)
	m.viewport.GotoTop()
}

func (m Model) updateDeleteConfirm(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "y":
		return m, m.deleteProtocol()
	case "n", "esc":
		m.mode = viewList
	case "q", "ctrl+c":
		return m, tea.Quit
	}
	return m, nil
}

func (m Model) generateAll() tea.Cmd {
	return func() tea.Msg {
		simpleDir := m.protocolsDir
		strictDir := filepath.Join(filepath.Dir(m.protocolsDir), "strict")

		if err := simple.Generate(m.protocols, simpleDir); err != nil {
			return GenerateMsg{Mode: "simple", Err: err}
		}
		if err := strict.Generate(m.protocols, strictDir); err != nil {
			return GenerateMsg{Mode: "strict", Err: err}
		}
		return GenerateMsg{Mode: "all", Err: nil}
	}
}

func (m Model) reloadProtocols() tea.Cmd {
	return func() tea.Msg {
		protocols, err := parser.ParseDir(m.protocolsDir)
		if err != nil {
			return ReloadMsg{Err: err}
		}
		return ReloadMsg{Protocols: protocols}
	}
}
