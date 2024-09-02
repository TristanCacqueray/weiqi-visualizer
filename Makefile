.PHONY: dev
dev:
	npx vite --host 0.0.0.0 src

.PHONY: publish
publish:
	rm -Rf pages/assets
	npx vite build src --base /weiqi-visualizer --outDir ../pages/
	bash -c "cd pages && git add assets && git commit -a -m pages --amend && git push -f origin pages"

.PHONY: release
release:
# remove optional dependencies to reduce bundle size
	rm -Rf node_modules/iconv-lite/ node_modules/jschardet/
	npx vite build --minify --sourcemap
