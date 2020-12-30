package lsifstore

import (
	"fmt"
	"strconv"
	"testing"

	"github.com/google/go-cmp/cmp"
	protocol "github.com/sourcegraph/lsif-protocol"
)

func TestBuildSymbolTree(t *testing.T) {
	symbolData := func(id uint64, children ...uint64) SymbolData {
		return SymbolData{
			ID:         id,
			SymbolData: protocol.SymbolData{Text: fmt.Sprint(id)},
			Children:   children,
		}
	}
	tests := []struct {
		datas []SymbolData
		want  []Symbol
	}{
		{
			datas: []SymbolData{symbolData(1, 2), symbolData(2)},
			want: []Symbol{
				{
					SymbolData: protocol.SymbolData{Text: "1"},
					Children: []Symbol{
						{SymbolData: protocol.SymbolData{Text: "2"}},
					},
				},
			},
		},
		{
			datas: []SymbolData{
				symbolData(10, 20, 30),
				symbolData(20, 21, 22),
				symbolData(21, 23),
				symbolData(22),
				symbolData(23),
				symbolData(30, 31),
				symbolData(31),
			},
			want: []Symbol{
				{
					SymbolData: protocol.SymbolData{Text: "10"},
					Children: []Symbol{
						{
							SymbolData: protocol.SymbolData{Text: "20"},
							Children: []Symbol{
								{
									SymbolData: protocol.SymbolData{Text: "21"},
									Children: []Symbol{
										{SymbolData: protocol.SymbolData{Text: "23"}},
									},
								},
								{
									SymbolData: protocol.SymbolData{Text: "22"},
								},
							},
						},
						{
							SymbolData: protocol.SymbolData{Text: "30"},
							Children: []Symbol{
								{SymbolData: protocol.SymbolData{Text: "31"}},
							},
						},
					},
				},
			},
		},
	}

	for i, test := range tests {
		t.Run(strconv.Itoa(i), func(t *testing.T) {
			got := buildSymbolTree(test.datas, 0)
			if diff := cmp.Diff(test.want, got); diff != "" {
				t.Errorf("unexpected tree (-want +got):\n%s", diff)
			}
		})
	}
}
