# Box Diagram

Each rendered diagram is followed by the verbatim source that produced it.

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
