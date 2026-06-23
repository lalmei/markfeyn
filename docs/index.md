# MarkFeyn

MarkFeyn renders fenced `feynman` code blocks as native SVG diagrams in MkDocs and ProperDocs.

The package is intentionally small:

- MkDocs or ProperDocs loads one plugin.
- The plugin copies one bundled JavaScript file into the site.
- The browser parses the diagram syntax and replaces matching code blocks with SVG.
- No JavaScript runtime dependencies are required.

```feynman
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
fermion i2->v1 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1->v2:γ
```

Start with [Installation](installation.md), then see [Syntax](syntax.md) and [Examples](examples/index.md).
