package model

import "fmt"

type TypeInfo struct {
	Name     string
	Bits     int
	Signed   bool
	IsFloat  bool
	MinValue string
	MaxValue string
}

var KnownTypes = map[string]TypeInfo{
	"u8":   {Name: "u8", Bits: 8, Signed: false, IsFloat: false, MinValue: "0", MaxValue: "255"},
	"u16":  {Name: "u16", Bits: 16, Signed: false, IsFloat: false, MinValue: "0", MaxValue: "65535"},
	"u32":  {Name: "u32", Bits: 32, Signed: false, IsFloat: false, MinValue: "0", MaxValue: "4294967295"},
	"u64":  {Name: "u64", Bits: 64, Signed: false, IsFloat: false, MinValue: "0", MaxValue: "18446744073709551615"},
	"i8":   {Name: "i8", Bits: 8, Signed: true, IsFloat: false, MinValue: "-128", MaxValue: "127"},
	"i16":  {Name: "i16", Bits: 16, Signed: true, IsFloat: false, MinValue: "-32768", MaxValue: "32767"},
	"i32":  {Name: "i32", Bits: 32, Signed: true, IsFloat: false, MinValue: "-2147483648", MaxValue: "2147483647"},
	"i64":  {Name: "i64", Bits: 64, Signed: true, IsFloat: false, MinValue: "-9223372036854775808", MaxValue: "9223372036854775807"},
	"f16":  {Name: "f16", Bits: 16, Signed: true, IsFloat: true, MinValue: "-65504.0", MaxValue: "65504.0"},
	"f32":  {Name: "f32", Bits: 32, Signed: true, IsFloat: true, MinValue: "-3.4028235e+38", MaxValue: "3.4028235e+38"},
	"f64":  {Name: "f64", Bits: 64, Signed: true, IsFloat: true, MinValue: "-1.7976931348623157e+308", MaxValue: "1.7976931348623157e+308"},
	"bool": {Name: "bool", Bits: 1, Signed: false, IsFloat: false, MinValue: "0", MaxValue: "1"},
}

type Field struct {
	Name     string
	Type     string
	Children []*Field
	Enum     *EnumDef
	BitSize  int
	Offset   int
}

type EnumDef struct {
	Variants []string
	Bits     int
}

type Protocol struct {
	Name      string
	PacketID  uint16
	Fields    []*Field
	Reliable  bool
	Ordered   bool
	TotalBits int
}

func (p *Protocol) ResolveBits() {
	offset := 0
	for _, f := range p.Fields {
		bits := ResolveFieldBits(f, offset)
		offset += bits
	}
	p.TotalBits = offset
}

func BitsForEnum(n int) int {
	if n <= 1 {
		return 1
	}
	bits := 0
	v := n - 1
	for v > 0 {
		bits++
		v >>= 1
	}
	return bits
}

func ResolveFieldBits(f *Field, offset int) int {
	if f.Enum != nil {
		f.Enum.Bits = BitsForEnum(len(f.Enum.Variants))
		f.BitSize = f.Enum.Bits
		f.Offset = offset
		return f.BitSize
	}

	if len(f.Children) > 0 {
		totalBits := 0
		for _, child := range f.Children {
			bits := ResolveFieldBits(child, offset+totalBits)
			totalBits += bits
		}
		f.BitSize = totalBits
		f.Offset = offset
		return totalBits
	}

	if info, ok := KnownTypes[f.Type]; ok {
		f.BitSize = info.Bits
		f.Offset = offset
		return f.BitSize
	}

	f.BitSize = 0
	f.Offset = offset
	return 0
}

func (p *Protocol) TotalBytes() int {
	return (p.TotalBits + 7) / 8
}

func FormatBitRange(offset, size int) string {
	if size == 0 {
		return "N/A"
	}
	end := offset + size - 1
	if offset == end {
		return fmt.Sprintf("bit %d", offset)
	}
	return fmt.Sprintf("bits %d..%d", offset, end)
}
