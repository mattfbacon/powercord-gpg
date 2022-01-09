DIR_SOURCE := src
SOURCES := constants.tsx DecryptContainer.tsx index.tsx PGP.tsx Settings.tsx util.tsx

dist: $(addprefix $(DIR_SOURCE)/,$(SOURCES))
	npx tsc
