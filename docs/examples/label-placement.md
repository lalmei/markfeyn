# Label Placement

MarkFeyn resolves label anchors after the graph geometry is fixed. The pass keeps
vertex coordinates and topology unchanged while moving labels away from sampled
propagators, vertices, loop interiors, and already placed labels where a local
candidate is available.

## Node label avoids a propagator

```feynman
options width=360 height=220
position a 70 62
position b 290 62
position c 180 86
plain a->b
vertex c:dot
label c:CENTRAL_LABEL
```

## Dense loop labels

```feynman
layout spring
incoming g1 g2
outgoing h
gluon g1->a g2->b
fermion a->b[edge label=k] b->c[momentum=q] c->a
scalar c->h
label g1:g g2:g h:H a:a b:b c:c
```
