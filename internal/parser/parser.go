package parser

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/tik-choco-lab/protocol/internal/model"
	"gopkg.in/yaml.v3"
)

// rawProtocol maps the YAML structure
type rawProtocol struct {
	Struct   map[string]interface{} `yaml:"struct"`
	Base     map[string]interface{} `yaml:"base"`
	Reliable *bool                  `yaml:"reliable"`
	Ordered  *bool                  `yaml:"ordered"`
}

// ParseDir reads all .yaml files in the given directory and returns parsed protocols
func ParseDir(dir string) ([]*model.Protocol, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory %s: %w", dir, err)
	}

	var protocols []*model.Protocol
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".yaml") || strings.HasPrefix(entry.Name(), "_") {
			continue
		}
		p, err := ParseFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			return nil, fmt.Errorf("failed to parse %s: %w", entry.Name(), err)
		}
		protocols = append(protocols, p)
	}

	// Sort alphabetically by name
	sort.Slice(protocols, func(i, j int) bool {
		return protocols[i].Name < protocols[j].Name
	})

	// Assign packet IDs in order
	for i, p := range protocols {
		p.PacketID = uint16(i + 1)
	}

	return protocols, nil
}

// ParseFile reads a single YAML protocol file
func ParseFile(path string) (*model.Protocol, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var raw rawProtocol
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	name := strings.TrimSuffix(filepath.Base(path), ".yaml")

	p := &model.Protocol{
		Name:     name,
		Reliable: true, // default
		Ordered:  true, // default
	}

	if raw.Reliable != nil {
		p.Reliable = *raw.Reliable
	}
	if raw.Ordered != nil {
		p.Ordered = *raw.Ordered
	}

	// Parse struct fields
	fieldMap := raw.Struct
	if fieldMap == nil {
		fieldMap = raw.Base
	}

	if fieldMap != nil {
		fields, err := parseFields(fieldMap)
		if err != nil {
			return nil, err
		}
		p.Fields = fields
	}

	// Resolve bit sizes and offsets
	offset := 0
	for _, f := range p.Fields {
		bits := model.ResolveFieldBits(f, offset)
		offset += bits
	}
	p.TotalBits = offset

	return p, nil
}

// parseFields recursively parses field definitions from a map
func parseFields(m map[string]interface{}) ([]*model.Field, error) {
	// We need stable ordering — YAML maps may not preserve order,
	// but gopkg.in/yaml.v3 with map[string]interface{} may not preserve it.
	// We'll sort keys alphabetically for consistency.
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var fields []*model.Field
	for _, name := range keys {
		val := m[name]
		field, err := parseField(name, val)
		if err != nil {
			return nil, fmt.Errorf("field %q: %w", name, err)
		}
		fields = append(fields, field)
	}
	return fields, nil
}

// parseField parses a single field definition
func parseField(name string, val interface{}) (*model.Field, error) {
	f := &model.Field{Name: name}

	switch v := val.(type) {
	case string:
		// Primitive type like "u32", "f32", etc.
		f.Type = v
		return f, nil

	case map[string]interface{}:
		// Could be a nested struct or an enum
		if enumVal, ok := v["enum"]; ok {
			// Enum type
			enumList, ok := enumVal.([]interface{})
			if !ok {
				return nil, fmt.Errorf("enum must be a list")
			}
			variants := make([]string, len(enumList))
			for i, ev := range enumList {
				s, ok := ev.(string)
				if !ok {
					return nil, fmt.Errorf("enum variant must be a string")
				}
				variants[i] = s
			}
			f.Type = "enum"
			f.Enum = &model.EnumDef{Variants: variants}
			return f, nil
		}

		// Nested struct
		f.Type = "struct"
		children, err := parseFields(v)
		if err != nil {
			return nil, err
		}
		f.Children = children
		return f, nil

	default:
		return nil, fmt.Errorf("unsupported value type: %T", val)
	}
}
