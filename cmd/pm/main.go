package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/tik-choco-lab/protocol/internal/output/simple"
	"github.com/tik-choco-lab/protocol/internal/output/strict"
	"github.com/tik-choco-lab/protocol/internal/parser"
	"github.com/tik-choco-lab/protocol/internal/tui"
)

func main() {
	protocolsDir := filepath.Join("output", "simple")
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "help", "--help", "-h":
			printHelp()
			return
		case "generate", "gen":
			runGenerate(os.Args[2:])
			return
		default:
			protocolsDir = os.Args[1]
		}
	}

	absDir, err := filepath.Abs(protocolsDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if err := os.MkdirAll(absDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	protocols, err := parser.ParseDir(absDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing protocols: %v\n", err)
		os.Exit(1)
	}

	if err := tui.Run(protocols, absDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func runGenerate(args []string) {
	protocolsDir := filepath.Join("output", "simple")
	if len(args) > 0 {
		protocolsDir = args[0]
	}

	absDir, err := filepath.Abs(protocolsDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	protocols, err := parser.ParseDir(absDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing protocols: %v\n", err)
		os.Exit(1)
	}

	simpleDir := absDir
	strictDir := filepath.Join(filepath.Dir(absDir), "strict")

	if err := simple.Generate(protocols, simpleDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if err := strict.Generate(protocols, strictDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func printHelp() {
	fmt.Println(`📦 Protocol Manager (pm)

Usage:
  pm                       Launch TUI with ./output/simple directory
  pm <dir>                 Launch TUI with specified protocols directory
  pm generate [dir]        Generate output files (simple + strict)
  pm help                  Show this help message

TUI Keybindings:
  ↑/↓ or k/j              Navigate protocol list
  a                        Add new protocol
  e                        Edit selected protocol
  s                        View selected protocol (simple format)
  d                        View selected protocol (strict/detailed format)
  S                        View all protocols (simple format)
  D                        View all protocols (strict/detailed format)
  Tab                      Toggle between simple/strict in detail view
  g                        Generate output files
  x                        Delete protocol
  Esc/Backspace            Return to list
  q                        Quit`)
}
