package simple

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/tik-choco-lab/protocol/internal/model"
	"gopkg.in/yaml.v3"
)

const (
	permDir  = 0o755
	permFile = 0o644
)

type protocolYAML struct {
	Name     string                 `yaml:"name"`
	Fields   map[string]interface{} `yaml:"fields"`
	Reliable bool                   `yaml:"reliable"`
	Ordered  bool                   `yaml:"ordered"`
}

func Generate(protocols []*model.Protocol, outDir string) error {
	if err := os.MkdirAll(outDir, permDir); err != nil {
		return fmt.Errorf("failed to create output dir: %w", err)
	}

	for _, p := range protocols {
		data := buildYAML(p)
		out, err := yaml.Marshal(data)
		if err != nil {
			return fmt.Errorf("failed to marshal %s: %w", p.Name, err)
		}
		path := filepath.Join(outDir, p.Name+".yaml")
		if err := os.WriteFile(path, out, permFile); err != nil {
			return fmt.Errorf("failed to write %s: %w", path, err)
		}
	}

	index := buildIndex(protocols)
	out, err := yaml.Marshal(index)
	if err != nil {
		return fmt.Errorf("failed to marshal index: %w", err)
	}
	indexPath := filepath.Join(outDir, "_index.yaml")
	if err := os.WriteFile(indexPath, out, permFile); err != nil {
		return fmt.Errorf("failed to write index: %w", err)
	}

	return nil
}

func buildIndex(protocols []*model.Protocol) interface{} {
	items := make([]map[string]interface{}, len(protocols))
	for i, p := range protocols {
		items[i] = map[string]interface{}{
			"name":     p.Name,
			"reliable": p.Reliable,
			"ordered":  p.Ordered,
		}
	}
	return map[string]interface{}{
		"protocols": items,
		"total":     len(protocols),
	}
}

func buildYAML(p *model.Protocol) protocolYAML {
	return protocolYAML{
		Name:     p.Name,
		Fields:   fieldsToMap(p.Fields),
		Reliable: p.Reliable,
		Ordered:  p.Ordered,
	}
}

func fieldsToMap(fields []*model.Field) map[string]interface{} {
	m := make(map[string]interface{})
	for _, f := range fields {
		if f.Enum != nil {
			m[f.Name] = map[string]interface{}{
				"enum": f.Enum.Variants,
			}
		} else if len(f.Children) > 0 {
			m[f.Name] = fieldsToMap(f.Children)
		} else {
			m[f.Name] = f.Type
		}
	}
	return m
}

func RenderPreview(p *model.Protocol) string {
	data := buildYAML(p)
	out, err := yaml.Marshal(data)
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	return string(out)
}

func RenderAllPreview(protocols []*model.Protocol) string {
	var sb strings.Builder
	for i, p := range protocols {
		if i > 0 {
			sb.WriteString("---\n")
		}
		sb.WriteString(RenderPreview(p))
	}
	return sb.String()
}
