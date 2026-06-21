# Examples

## Electron-Positron Scattering

```feynman
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
fermion i2->v1 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1:γ
```

## Scalar Exchange

```feynman
incoming a b
outgoing c d
scalar a->v1 v2->c
scalar b->v1 v2->d
scalar v1->v2
label a:ϕ b:ϕ c:ϕ d:ϕ v1->v2:H
```

## Gluon Emission

```feynman
incoming q
outgoing q2 g
fermion q->v1 v1->q2
gluon v1->g
label q:q q2:q g:g
```

## Mixed Vertex

```feynman
incoming q g
outgoing q2 h
fermion q->v1 v2->q2
gluon g->v1
photon v1->v2
scalar v2->h
label q:q g:g q2:q h:H v1->v2:γ
```
