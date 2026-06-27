# Layout

Each rendered diagram is followed by the verbatim source that produced it.

## Layout Algorithms

The same decay can be drawn with different automatic layouts.

=== "layered"

    ````
    ```feynman
    layout layered
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```
    ````

=== "spring"

    ````
    ```feynman
    layout spring
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```
    ````

=== "electrical spring"

    ````
    ```feynman
    layout spring electrical
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```
    ````

---

=== "layered"

    ```feynman
    layout layered
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```

=== "spring"

    ```feynman
    layout spring
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```

=== "electrical spring"

    ```feynman
    layout spring electrical
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```

Source:

````markdown
```feynman
layout spring
incoming mu
outgoing numu nue e
fermion mu->w w->numu
boson w->v
anti fermion nue->v
fermion v->e
label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
```
````

```feynman
layout spring electrical
incoming mu
outgoing numu nue e
fermion mu->w w->numu
boson w->v
anti fermion nue->v
fermion v->e
label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
```

Source:

````markdown
```feynman
layout spring electrical
incoming mu
outgoing numu nue e
fermion mu->w w->numu
boson w->v
anti fermion nue->v
fermion v->e
label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
```
````

```feynman
layout tree
incoming mu
outgoing numu nue e
fermion mu->w w->numu
boson w->v
anti fermion nue->v
fermion v->e
label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
```

Source:

````markdown
```feynman
layout tree
incoming mu
outgoing numu nue e
fermion mu->w w->numu
boson w->v
anti fermion nue->v
fermion v->e
label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
```
````

## Vertical Orientation

```feynman
tikz vertical a to b
incoming e positron
outgoing electron positron2
fermion e->a a->electron
photon a->b
anti fermion positron2->b b->positron
label e:e^- positron:e^+ electron:e^- positron2:e^+ a->b:\gamma
```

Source:

````markdown
```feynman
tikz vertical a to b
incoming e positron
outgoing electron positron2
fermion e->a a->electron
photon a->b
anti fermion positron2->b b->positron
label e:e^- positron:e^+ electron:e^- positron2:e^+ a->b:\gamma
```
````

## Invisible Layout Edge

```feynman

size medium
incoming pi0
outgoing gamma1 gamma2
scalar pi0->t1
fermion t1->t2 t2->t3 t3->t1
photon t2->gamma1 t3->gamma2
invisible gamma1->gamma2
label pi0:\pi^0 gamma1:\gamma gamma2:\gamma
```

Source:

````markdown
```feynman
layout spring
incoming pi0
outgoing gamma1 gamma2
scalar pi0->t1
fermion t1->t2 t2->t3 t3->t1
photon t2->gamma1 t3->gamma2
invisible gamma1->gamma2
label pi0:\pi^0 gamma1:\gamma gamma2:\gamma
```
````

## Manual Placement

```feynman
options width=520 height=300
position a 80 150
position b 240 80
position c 240 220
position d 440 150
fermion a->b b->d
photon a->c c->d
label a:e^- d:e^+ b:\gamma c:Z
```

Source:

````markdown
```feynman
options width=520 height=300
position a 80 150
position b 240 80
position c 240 220
position d 440 150
fermion a->b b->d
photon a->c c->d
label a:e^- d:e^+ b:\gamma c:Z
```
````

## Label Placement

MarkFeyn resolves label anchors after the graph geometry is fixed. The pass keeps
vertex coordinates and topology unchanged while moving labels away from sampled
propagators, vertices, loop interiors, and already placed labels where a local
candidate is available.

### Node label avoids a propagator

```feynman
options width=360 height=220
position a 70 62
position b 290 62
position c 180 86
plain a->b
vertex c:dot
label c:CENTRAL_LABEL
```

### Dense loop labels

```feynman
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b[edge label=k] b->c[momentum=q] c->a
scalar c->h
label g1:g g2:g h:H a:a b:b c:c
```
