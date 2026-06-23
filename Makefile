.PHONY: help sync build-js test test-py test-js docs build-docs serve-docs serve build package publish publish-test clean

PYTEST := uv run --group dev pytest
PROPERDOCS := uv run properdocs
MKDOCS := uv run mkdocs
JS_RENDERER := src/markfeyn/assets/feynman-diagrams.js
DIST_FILES := dist/markfeyn-*.tar.gz dist/markfeyn-*-py3-none-any.whl
DOCS_ADDR ?= localhost:8001

help:
	@echo "Targets:"
	@echo "  sync        Install/update the uv environment"
	@echo "  build-js    Bundle the browser renderer"
	@echo "  test        Run Python and JavaScript tests"
	@echo "  test-py     Run pytest"
	@echo "  test-js     Check and run the JavaScript renderer tests"
	@echo "  docs        Build MkDocs and ProperDocs documentation with strict checks"
	@echo "  docs-mkdocs Build MkDocs documentation with strict checks"
	@echo "  docs-properdocs Build ProperDocs documentation with strict checks"
	@echo "  serve-docs  Serve documentation locally"
	@echo "  serve-mkdocs Serve documentation locally with MkDocs"
	@echo "  serve-properdocs Serve documentation locally with ProperDocs"
	@echo "  build       Build distribution artifacts"
	@echo "  publish     Publish artifacts to PyPI with uv"
	@echo "  publish-test Publish artifacts to TestPyPI with uv"
	@echo "  clean       Remove generated build outputs"
	@echo ""
	@echo "Variables:"
	@echo "  DOCS_ADDR   Serve address (default: $(DOCS_ADDR))"

sync:
	uv sync --group dev

build-js:
	npm run build:js

test: test-py test-js

test-py:
	$(PYTEST)

test-js: build-js
	node --check $(JS_RENDERER)
	node tests/feynman-diagrams.test.js

docs: build-js docs-properdocs docs-mkdocs

build-docs: docs

docs-properdocs:
	$(PROPERDOCS) build --strict

docs-mkdocs:
	$(MKDOCS) build --strict

serve-docs: serve-properdocs

serve-properdocs:
	$(PROPERDOCS) serve --dev-addr $(DOCS_ADDR)

serve-mkdocs:
	$(MKDOCS) serve --dev-addr $(DOCS_ADDR)

serve: serve-docs

build: package

package: build-js
	uv build

publish: package
	uv publish $(DIST_FILES)

publish-test: package
	uv publish --publish-url https://test.pypi.org/legacy/ $(DIST_FILES)

clean:
	rm -rf build dist site src/*.egg-info .pytest_cache
