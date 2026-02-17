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
	Struct   map[string]interface{} `yaml:"struct"`
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

	return nil
}

func buildYAML(p *model.Protocol) protocolYAML {
	return protocolYAML{
		Name:     p.Name,
		Struct:   fieldsToMap(p.Fields),
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
