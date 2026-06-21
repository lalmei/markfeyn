# Syntax

A diagram is written as a fenced code block tagged with `feynman`:

````markdown
```feynman
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
scalar i2->v2 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1:γ
```
````

## Nodes

External nodes are declared with `incoming` and `outgoing`:

```feynman
incoming e positron
outgoing muon antimuon
fermion e->v1 v1->muon
fermion positron->v1 v1->antimuon
label e:e⁻ positron:e⁺ muon:μ⁻ antimuon:μ⁺
```

Internal vertices do not need separate declarations. Any node used in an edge that is not listed as incoming or outgoing is treated as an internal vertex.

## Edges

Edges use `from->to` notation. Multiple edges of the same type can be written on one line.

Supported particle types:

| Type | Rendering |
| --- | --- |
| `fermion` | Solid line with centered arrow |
| `photon` | Sinusoidal wave |
| `gluon` | Looped path |
| `scalar` | Dashed line |

## Labels

Node labels use `node:text`:

```feynman
incoming q
outgoing q2
fermion q->v1 v1->q2
label q:q q2:q v1:V
```

Labels with spaces can be quoted:

```feynman
incoming i1
outgoing o1
fermion i1->v1 v1->o1
label i1:"incoming particle" o1:"outgoing particle"
```

Labels support a small TeX-like subset for common symbols and scripts. Use `\mu`,
`\gamma`, and other Greek symbol commands directly, plus `^` and `_` for
superscripts and subscripts. Braces group multi-character scripts:

```feynman
incoming e positron
outgoing muon antimuon
fermion e->v1 positron->v1 v1->muon v1->antimuon
label e:e^- positron:e^+ muon:\mu^- antimuon:\mu^+ v1:\gamma
```

```feynman
incoming p1
outgoing p2
fermion p1->v1 v1->p2
label p1:p_{T} p2:m_{\mu}^{2}
```

Edge labels use `from->to:text`:

```feynman
incoming i1
outgoing o1
fermion i1->v1
photon v1->o1
label v1->o1:γ
```

## Comments

Blank lines and lines starting with `#` are ignored.
