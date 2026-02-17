package strict

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/tik-choco-lab/protocol/internal/model"
)

const (
	permDir  = 0o755
	permFile = 0o644
)

type ProtocolJSON struct {
	Name       string      `json:"name"`
	PacketID   uint16      `json:"packet_id"`
	PacketHex  string      `json:"packet_id_hex"`
	TotalBits  int         `json:"total_bits"`
	TotalBytes int         `json:"total_bytes"`
	Reliable   bool        `json:"reliable"`
	Ordered    bool        `json:"ordered"`
	Fields     []FieldJSON `json:"fields"`
}

type FieldJSON struct {
	Name      string      `json:"name"`
	Type      string      `json:"type"`
	Bits      int         `json:"bits"`
	BitOffset int         `json:"bit_offset"`
	BitRange  string      `json:"bit_range"`
	Min       *string     `json:"min,omitempty"`
	Max       *string     `json:"max,omitempty"`
	Variants  []EnumValue `json:"variants,omitempty"`
	Children  []FieldJSON `json:"children,omitempty"`
}

type EnumValue struct {
	Value int    `json:"value"`
	Name  string `json:"name"`
}

type IndexJSON struct {
	Protocols []ProtocolSummary `json:"protocols"`
}

type ProtocolSummary struct {
	Name       string `json:"name"`
	PacketID   uint16 `json:"packet_id"`
	PacketHex  string `json:"packet_id_hex"`
	Reliable   bool   `json:"reliable"`
	Ordered    bool   `json:"ordered"`
	TotalBits  int    `json:"total_bits"`
	TotalBytes int    `json:"total_bytes"`
}

func Generate(protocols []*model.Protocol, outDir string) error {
	if err := os.MkdirAll(outDir, permDir); err != nil {
		return fmt.Errorf("failed to create output dir: %w", err)
	}

	for _, p := range protocols {
		data := buildJSON(p)
		out, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal %s: %w", p.Name, err)
		}
		path := filepath.Join(outDir, p.Name+".json")
		if err := os.WriteFile(path, out, permFile); err != nil {
			return fmt.Errorf("failed to write %s: %w", path, err)
		}
	}

	index := IndexJSON{
		Protocols: make([]ProtocolSummary, len(protocols)),
	}
	for i, p := range protocols {
		index.Protocols[i] = ProtocolSummary{
			Name:       p.Name,
			PacketID:   p.PacketID,
			PacketHex:  fmt.Sprintf("0x%04X", p.PacketID),
			Reliable:   p.Reliable,
			Ordered:    p.Ordered,
			TotalBits:  p.TotalBits,
			TotalBytes: p.TotalBytes(),
		}
	}
	idxOut, _ := json.MarshalIndent(index, "", "  ")
	return os.WriteFile(filepath.Join(outDir, "manifest.json"), idxOut, permFile)
}

func buildJSON(p *model.Protocol) ProtocolJSON {
	return ProtocolJSON{
		Name:       p.Name,
		PacketID:   p.PacketID,
		PacketHex:  fmt.Sprintf("0x%04X", p.PacketID),
		TotalBits:  p.TotalBits,
		TotalBytes: p.TotalBytes(),
		Reliable:   p.Reliable,
		Ordered:    p.Ordered,
		Fields:     fieldsToJSON(p.Fields),
	}
}

func fieldsToJSON(fields []*model.Field) []FieldJSON {
	result := make([]FieldJSON, len(fields))
	for i, f := range fields {
		fj := FieldJSON{
			Name:      f.Name,
			Type:      f.Type,
			Bits:      f.BitSize,
			BitOffset: f.Offset,
			BitRange:  model.FormatBitRange(f.Offset, f.BitSize),
		}

		if f.Enum != nil {
			variants := make([]EnumValue, len(f.Enum.Variants))
			for vi, v := range f.Enum.Variants {
				variants[vi] = EnumValue{Value: vi, Name: v}
			}
			fj.Variants = variants
		} else if len(f.Children) > 0 {
			fj.Children = fieldsToJSON(f.Children)
		} else {
			if info, ok := model.KnownTypes[f.Type]; ok {
				fj.Min = &info.MinValue
				fj.Max = &info.MaxValue
			}
		}

		result[i] = fj
	}
	return result
}

func RenderPreview(p *model.Protocol) string {
	data := buildJSON(p)
	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	return string(out)
}

func RenderAllPreview(protocols []*model.Protocol) string {
	var sb strings.Builder
	all := make([]ProtocolJSON, len(protocols))
	for i, p := range protocols {
		all[i] = buildJSON(p)
	}
	out, err := json.MarshalIndent(all, "", "  ")
	if err != nil {
		return fmt.Sprintf("error: %v", err)
	}
	sb.Write(out)
	return sb.String()
}
