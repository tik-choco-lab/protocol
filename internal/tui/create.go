package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/tik-choco-lab/protocol/internal/model"
)

type createStep int

const (
	createStepName createStep = iota
	createStepFieldName
	createStepFieldType
	createStepEnumVariant
	createStepReliable
	createStepOrdered
	createStepConfirm
)

const (
	charLimit      = 64
	textInputWidth = 40
	initialIndent  = 1
	treeIndent     = 2
	togglePadding  = 2
)

var typeOptions = []string{
	"u8", "u16", "u32", "u64",
	"i8", "i16", "i32", "i64",
	"f16", "f32", "f64",
	"bool",
	"string",
	"byte[]",
	"── special ──",
	"struct",
	"enum",
}

type CreateModel struct {
	step                createStep
	textInput           textinput.Model
	protocolName        string
	originalName        string
	reliable            bool
	ordered             bool
	rootFields          []*model.Field
	fieldStack          []fieldContext
	fieldCursor         int
	editingIndex        int
	typeCursor          int
	currentFieldName    string
	currentEnumVariants []string
	protocolsDir        string
	done                bool
	saved               bool
	errMsg              string
	skipNextKey         bool
}

type fieldContext struct {
	parentField *model.Field
	fieldName   string
}

func NewCreateModel(protocolsDir string) CreateModel {
	ti := textinput.New()
	ti.Focus()
	ti.Placeholder = "protocol_name"
	ti.CharLimit = charLimit
	ti.Width = textInputWidth

	return CreateModel{
		step:         createStepName,
		textInput:    ti,
		protocolsDir: protocolsDir,
		reliable:     true,
		ordered:      true,
		editingIndex: -1,
	}
}

func NewEditModel(p *model.Protocol, protocolsDir string) CreateModel {
	ti := textinput.New()
	ti.Focus()
	ti.SetValue(p.Name)
	ti.CharLimit = charLimit
	ti.Width = textInputWidth

	return CreateModel{
		step:         createStepName,
		textInput:    ti,
		protocolName: p.Name,
		originalName: p.Name,
		rootFields:   p.Fields,
		reliable:     p.Reliable,
		ordered:      p.Ordered,
		protocolsDir: protocolsDir,
		editingIndex: -1,
	}
}

func (m *CreateModel) currentFields() *[]*model.Field {
	if len(m.fieldStack) == 0 {
		return &m.rootFields
	}
	top := m.fieldStack[len(m.fieldStack)-1]
	return &top.parentField.Children
}

func (m *CreateModel) breadcrumb() string {
	if len(m.fieldStack) == 0 {
		return "root"
	}
	parts := make([]string, len(m.fieldStack))
	for i, ctx := range m.fieldStack {
		parts[i] = ctx.fieldName
	}
	return strings.Join(parts, " > ")
}

func (m *CreateModel) Update(msg tea.KeyMsg) tea.Cmd {
	m.errMsg = ""

	handlers := map[createStep]func(tea.KeyMsg) tea.Cmd{
		createStepName:        m.updateName,
		createStepFieldName:   m.updateFieldName,
		createStepFieldType:   m.updateFieldType,
		createStepEnumVariant: m.updateEnumVariant,
		createStepReliable:    m.updateReliable,
		createStepOrdered:     m.updateOrdered,
		createStepConfirm:     m.updateConfirm,
	}

	if handler, ok := handlers[m.step]; ok {
		return handler(msg)
	}
	return nil
}

func (m *CreateModel) UpdateTextInput(msg tea.Msg) tea.Cmd {
	if m.step == createStepFieldName {
		if _, ok := msg.(tea.KeyMsg); ok {
			if m.skipNextKey {
				m.skipNextKey = false
				return nil
			}
		}
	}

	if m.step == createStepName || m.step == createStepFieldName || m.step == createStepEnumVariant {
		var cmd tea.Cmd
		m.textInput, cmd = m.textInput.Update(msg)
		return cmd
	}
	return nil
}

func (m *CreateModel) updateName(msg tea.KeyMsg) tea.Cmd {
	switch msg.String() {
	case "enter":
		name := strings.TrimSpace(m.textInput.Value())
		if name == "" {
			m.errMsg = "名前を入力してください"
			return nil
		}
		name = strings.ToLower(strings.ReplaceAll(name, " ", "_"))
		m.protocolName = name
		m.step = createStepFieldName
		m.textInput.SetValue("")
		m.textInput.Placeholder = "field_name (空でフィールド追加終了)"
	case "esc":
		m.done = true
	}
	return nil
}

func (m *CreateModel) updateFieldName(msg tea.KeyMsg) tea.Cmd {
	fields := m.currentFields()
	numFields := len(*fields)

	switch msg.String() {
	case "up", "k":
		if numFields > 0 {
			m.fieldCursor = (m.fieldCursor - 1 + numFields) % numFields
			return nil
		}
	case "down", "j":
		if numFields > 0 {
			m.fieldCursor = (m.fieldCursor + 1) % numFields
			return nil
		}
	case "e":
		if numFields > 0 && m.editingIndex < 0 {
			return m.editSelectedField()
		}
	case "x":
		if numFields > 0 && m.editingIndex < 0 {
			m.skipNextKey = true
			*fields = append((*fields)[:m.fieldCursor], (*fields)[m.fieldCursor+1:]...)
			if m.fieldCursor >= len(*fields) && len(*fields) > 0 {
				m.fieldCursor = len(*fields) - 1
			}
			return nil
		}
	case "enter":
		name := strings.TrimSpace(m.textInput.Value())
		if name == "" {
			return m.handleEmptyFieldName()
		}
		name = strings.ToLower(strings.ReplaceAll(name, " ", "_"))
		if m.isDuplicateField(name) {
			m.errMsg = fmt.Sprintf("フィールド '%s' は既に存在します", name)
			return nil
		}
		m.currentFieldName = name
		m.step = createStepFieldType
		m.typeCursor = 0

		if m.editingIndex >= 0 {
			f := (*fields)[m.editingIndex]
			for i, opt := range typeOptions {
				if opt == f.Type {
					m.typeCursor = i
					break
				}
			}
			if f.Enum != nil {
				m.currentEnumVariants = f.Enum.Variants
			}
		}

	case "esc":
		if m.editingIndex >= 0 {
			m.editingIndex = -1
			m.textInput.SetValue("")
			return nil
		}
		if len(m.fieldStack) > 0 {
			m.fieldStack = m.fieldStack[:len(m.fieldStack)-1]
			m.fieldCursor = 0
			return nil
		}
		m.done = true
	}
	return nil
}

func (m *CreateModel) editSelectedField() tea.Cmd {
	fields := m.currentFields()
	if m.fieldCursor >= len(*fields) {
		return nil
	}

	f := (*fields)[m.fieldCursor]
	m.editingIndex = m.fieldCursor
	m.skipNextKey = true
	m.textInput.SetValue(f.Name)
	return nil
}

func (m *CreateModel) handleEmptyFieldName() tea.Cmd {
	if len(m.fieldStack) > 0 {
		m.fieldStack = m.fieldStack[:len(m.fieldStack)-1]
		m.textInput.SetValue("")
		m.textInput.Placeholder = "field_name (空でフィールド追加終了)"
		return nil
	}
	if len(m.rootFields) == 0 {
		m.errMsg = "少なくとも1つのフィールドが必要です"
		return nil
	}
	m.step = createStepReliable
	return nil
}

func (m *CreateModel) isDuplicateField(name string) bool {
	fields := m.currentFields()
	for i, f := range *fields {
		if i == m.editingIndex {
			continue
		}
		if f.Name == name {
			return true
		}
	}
	return false
}

func (m *CreateModel) updateFieldType(msg tea.KeyMsg) tea.Cmd {
	switch msg.String() {
	case "up", "k":
		m.moveTypeCursor(-1)
	case "down", "j":
		m.moveTypeCursor(1)
	case "enter":
		return m.handleSelectFieldType()
	case "esc":
		m.step = createStepFieldName
		m.textInput.SetValue("")
		m.textInput.Placeholder = "field_name (空でフィールド追加終了)"
	}
	return nil
}

func (m *CreateModel) moveTypeCursor(delta int) {
	n := len(typeOptions)
	m.typeCursor = (m.typeCursor + delta + n) % n
	if strings.HasPrefix(typeOptions[m.typeCursor], "──") {
		m.moveTypeCursor(delta)
	}
}

func (m *CreateModel) handleSelectFieldType() tea.Cmd {
	selected := typeOptions[m.typeCursor]
	fieldName := m.textInput.Value()

	if selected == "enum" {
		m.step = createStepEnumVariant
		m.currentEnumVariants = nil
		m.textInput.SetValue("")
		m.textInput.Placeholder = "variant名 (空で入力終了)"
		return nil
	}

	fields := m.currentFields()
	if m.editingIndex >= 0 {
		f := (*fields)[m.editingIndex]
		f.Name = fieldName
		f.Type = selected
		if selected != "struct" {
			f.Children = nil
		}
		if selected == "struct" {
			m.fieldStack = append(m.fieldStack, fieldContext{parentField: f, fieldName: fieldName})
			m.step = createStepFieldName
			m.textInput.SetValue("")
			m.textInput.Placeholder = "field_name (空でstruct終了)"
			m.editingIndex = -1
			return nil
		}
		m.editingIndex = -1
	} else {
		if selected == "struct" {
			f := &model.Field{Name: fieldName, Type: "struct"}
			*fields = append(*fields, f)
			m.fieldStack = append(m.fieldStack, fieldContext{parentField: f, fieldName: fieldName})
			m.step = createStepFieldName
			m.textInput.SetValue("")
			m.textInput.Placeholder = "field_name (空でstruct終了)"
			return nil
		}

		f := &model.Field{Name: fieldName, Type: selected}
		*fields = append(*fields, f)
	}

	m.step = createStepFieldName
	m.textInput.SetValue("")
	m.textInput.Placeholder = "field_name (空でフィールド追加終了)"
	return nil
}

func (m *CreateModel) updateEnumVariant(msg tea.KeyMsg) tea.Cmd {
	switch msg.String() {
	case "enter":
		variant := strings.TrimSpace(m.textInput.Value())
		if variant == "" {
			return m.handleFinishEnum()
		}
		variant = strings.ToLower(strings.ReplaceAll(variant, " ", "_"))
		m.currentEnumVariants = append(m.currentEnumVariants, variant)
		m.textInput.SetValue("")
	case "esc":
		m.step = createStepFieldType
		m.textInput.SetValue(m.currentFieldName)
	}
	return nil
}

func (m *CreateModel) handleFinishEnum() tea.Cmd {
	if len(m.currentEnumVariants) == 0 {
		m.errMsg = "少なくとも1つのvariantが必要です"
		return nil
	}

	fields := m.currentFields()
	if m.editingIndex >= 0 {
		f := (*fields)[m.editingIndex]
		f.Name = m.currentFieldName
		f.Type = "enum"
		f.Enum = &model.EnumDef{Variants: m.currentEnumVariants}
		f.Children = nil
		m.editingIndex = -1
	} else {
		f := &model.Field{
			Name: m.currentFieldName,
			Type: "enum",
			Enum: &model.EnumDef{Variants: m.currentEnumVariants},
		}
		*fields = append(*fields, f)
	}

	m.step = createStepFieldName
	m.textInput.SetValue("")
	m.textInput.Placeholder = "field_name (空でフィールド追加終了)"
	return nil
}

func (m *CreateModel) updateReliable(msg tea.KeyMsg) tea.Cmd {
	switch msg.String() {
	case "left", "right", "h", "l":
		m.reliable = !m.reliable
	case "enter":
		m.step = createStepOrdered
	case "esc":
		m.step = createStepFieldName
		m.textInput.SetValue("")
		m.textInput.Placeholder = "field_name (空でフィールド追加終了)"
	}
	return nil
}

func (m *CreateModel) updateOrdered(msg tea.KeyMsg) tea.Cmd {
	switch msg.String() {
	case "left", "right", "h", "l":
		m.ordered = !m.ordered
	case "enter":
		m.step = createStepConfirm
	case "esc":
		m.step = createStepReliable
	}
	return nil
}

func (m *CreateModel) updateConfirm(msg tea.KeyMsg) tea.Cmd {
	switch msg.String() {
	case "enter", "y":
		if err := m.save(); err != nil {
			m.errMsg = fmt.Sprintf("保存エラー: %v", err)
			return nil
		}
		m.saved = true
		m.done = true
	case "esc", "n":
		m.done = true
	}
	return nil
}
