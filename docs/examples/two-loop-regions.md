# Automatic Two-Loop Regions

Each rendered diagram is followed by the verbatim source that produced it.

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
