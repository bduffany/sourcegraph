package lsifstore

func newSymbolFromData(data SymbolData, dumpID int, all map[uint64]SymbolData, childSeen func(uint64)) Symbol {
	symbol := Symbol{
		DumpID:     dumpID,
		SymbolData: data.SymbolData,
		Locations:  data.Locations,
		Monikers:   data.Monikers,
	}
	for _, child := range data.Children {
		childSeen(child)
		symbol.Children = append(symbol.Children, newSymbolFromData(all[child], dumpID, all, childSeen))
	}
	return symbol
}

func walkSymbolTree(root *Symbol, walkFn func(symbol *Symbol)) {
	walkFn(root)
	for i := range root.Children {
		walkSymbolTree(&root.Children[i], walkFn)
	}
}
