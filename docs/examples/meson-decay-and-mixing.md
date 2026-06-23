# Meson Decay And Mixing

Each rendered diagram is followed by the verbatim source that produced it.

```feynman
options width=680 height=340
incoming a1 b1
outgoing a4 b2 c1 c3
position a1 90 185
position a2 250 185
position a3 360 185
position a4 520 185
position b1 90 255
position b2 520 255
position d 305 115
position c1 520 105
position c3 520 55
position c2 405 80
fermion a4->a3 a3->a2 a2->a1 b1->b2
fermion c3->c2[out=180, in=45] c2->c1[out=-45, in=180]
boson a2->d[quarter left] d->a3[quarter left] d->c2[bend left, edge label=W^+]
brace b1->a1[left]:B^0
brace c3->c1[right]:\pi^+
brace a4->b2[right]:\pi^-
label a1:\overline{b} b1:d a4:\overline{u} b2:d c1:u c3:\overline{d}
```

Source:

````markdown
```feynman
options width=880 height=340
incoming a1 b1
outgoing a4 b2 c1 c3
position a1 90 185
position a2 250 185
position a3 360 185
position a4 520 185
position b1 90 255
position b2 520 255
position d 305 115
position c1 520 105
position c3 520 55
position c2 405 80
fermion a4->a3 a3->a2 a2->a1 b1->b2
fermion c3->c2[out=180, in=45] c2->c1[out=-45, in=180]
boson a2->d[quarter left] d->a3[quarter left] d->c2[bend left, edge label=W^+]
brace b1->a1[left]:B^0
brace c3->c1[right]:\pi^+
brace a4->b2[right]:\pi^-
label a1:\overline{b} b1:d a4:\overline{u} b2:d c1:u c3:\overline{d}
```
````
