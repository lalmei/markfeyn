# Manual Placement

Each rendered diagram is followed by the verbatim source that produced it.

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
