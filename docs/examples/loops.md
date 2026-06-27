# Loops

Each rendered diagram is followed by the verbatim source that produced it.

## Automatic Layout

These examples rely on automatic layout only; no `position` commands are used.

### $\gamma$-self energy

Source:

````markdown
```feynman
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\gamma gamma2:\gamma
```
````

```feynman
layout spring
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\gamma gamma2:\gamma
```

Source:

````markdown
```feynman
layout spring
incoming e
outgoing e2
fermion e->a a->b b->e2
photon a->b[half left, edge label=\gamma]
fermion b->a[half left]
label e:e^- e2:e^-
```
````

```feynman
layout spring
incoming e
outgoing e2
fermion e->a a->b b->e2
photon a->b[half left, edge label=\gamma]
fermion b->a[half left]
label e:e^- e2:e^-
```

```feynman
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b b->c c->a
scalar c->h
label g1:g g2:g h:H
```

Source:

````markdown
```feynman
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b b->c c->a
scalar c->h
label g1:g g2:g h:H
```
````

## Manual Placement

These examples use explicit coordinates when the diagram should match a
specific publication layout.

### $\gamma$-mass

```feynman
options width=560 height=300
incoming a
outgoing d
position a 70 150
position b 220 150
position c 340 150
position d 490 150
photon a->b[momentum=p] c->d[momentum=p]
fermion b->c[half left, momentum=k] c->b[half left, momentum'=k-p]
label a:\gamma d:\gamma
```

Source:

````markdown
```feynman
options width=560 height=300
incoming a
outgoing d
position a 70 150
position b 220 150
position c 340 150
position d 490 150
photon a->b[momentum=p] c->d[momentum=p]
fermion b->c[half left, momentum=k] c->b[half left, momentum'=k-p]
label a:\gamma d:\gamma
```
````

```feynman
options width=560 height=340
position i1 70 90
position i2 70 250
position a 220 170
position b 360 170
position f1 500 90
position f2 500 250
gluon i1->a i2->a a->b[half left] b->a[half left] b->f1 b->f2
```

Source:

````markdown
```feynman
options width=560 height=340
position i1 70 90
position i2 70 250
position a 220 170
position b 360 170
position f1 500 90
position f2 500 250
gluon i1->a i2->a a->b[half left] b->a[half left] b->f1 b->f2
```
````

## Box Diagram

```feynman
options width=620 height=320
incoming i1 i2
outgoing f1 f2
position i1 90 90
position a 240 90
position b 390 90
position f1 530 90
position i2 90 230
position c 240 230
position d 390 230
position f2 530 230
fermion i1->a b->f1 a->c[edge label'=q]
anti fermion i2->c d->f2 b->d[edge label=\nu_\mu]
photon a->b[edge label=W^-] c->d[edge label'=W^+]
label i1:d i2:\overline{s} f1:\mu^- f2:\mu^+
```

Source:

````markdown
```feynman
options width=620 height=320
incoming i1 i2
outgoing f1 f2
position i1 90 90
position a 240 90
position b 390 90
position f1 530 90
position i2 90 230
position c 240 230
position d 390 230
position f2 530 230
fermion i1->a b->f1 a->c[edge label'=q]
anti fermion i2->c d->f2 b->d[edge label=\nu_\mu]
photon a->b[edge label=W^-] c->d[edge label'=W^+]
label i1:d i2:\overline{s} f1:\mu^- f2:\mu^+
```
````

## Automatic Two-Loop Regions

Shared-vertex, overlapping, and disjoint two-loop regions are detected
automatically and laid out with bounded, deterministic candidates before falling
back to generic graph layout.

### Shared-Vertex Two-Loop Region

```feynman
options width=620 height=320
scalar a->b b->c c->a
scalar c->d d->e e->c
vertex c:dot
label a:a b:b c:c d:d e:e
```

Source:

````markdown
```feynman
options width=620 height=320
scalar a->b b->c c->a
scalar c->d d->e e->c
vertex c:dot
label a:a b:b c:c d:d e:e
```
````

### Overlapping Two-Loop Region

```feynman
options width=620 height=320
scalar a->b b->c c->a
scalar b->d d->c
label a:a b:b c:c d:d
```

Source:

````markdown
```feynman
options width=620 height=320
scalar a->b b->c c->a
scalar b->d d->c
label a:a b:b c:c d:d
```
````

### Disjoint Two-Loop Vacuum Regions

```feynman
options width=680 height=320
scalar a->b b->c c->a
scalar d->e e->f f->d
label a:a b:b c:c d:d e:e f:f
```

Source:

````markdown
```feynman
options width=680 height=320
scalar a->b b->c c->a
scalar d->e e->f f->d
label a:a b:b c:c d:d e:e f:f
```
````

### Shared-Vertex Two-Loop Region With External Legs

```feynman
options width=700 height=360
incoming i
outgoing o1 o2
scalar i->a a->b b->c c->a
scalar c->d d->e e->c
scalar b->o1 e->o2
vertex c:dot
label i:i o1:o_1 o2:o_2 a:a b:b c:c d:d e:e
```

Source:

````markdown
```feynman
options width=700 height=360
incoming i
outgoing o1 o2
scalar i->a a->b b->c c->a
scalar c->d d->e e->c
scalar b->o1 e->o2
vertex c:dot
label i:i o1:o_1 o2:o_2 a:a b:b c:c d:d e:e
```
````

### Overlapping Two-Loop Region With Profiling

The JavaScript API can request profiling for any diagram:
`layoutFeynman(diagram, { profile: true })`. The returned
`layout.debug.profile` lists stages such as `topology`, `multiloop`, `layout`,
and `score`.

```feynman
options width=700 height=340
incoming l
outgoing r
scalar l->a
scalar a->b b->c c->a
scalar b->d d->c
scalar d->r
label l:L r:R a:a b:b c:c d:d
```

Source:

````markdown
```feynman
options width=700 height=340
incoming l
outgoing r
scalar l->a
scalar a->b b->c c->a
scalar b->d d->c
scalar d->r
label l:L r:R a:a b:b c:c d:d
```
````
