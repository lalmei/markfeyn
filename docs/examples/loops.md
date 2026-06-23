# Loops Examples

Each rendered diagram is followed by the verbatim source that produced it.

These examples rely on automatic layout only; no `position` commands are used.

$\gamma$-self energy

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

These examples use explicit coordinates when the diagram should match a
specific publication layout.

$\gamma$-mass

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
