# Invisible Layout Edge

Each rendered diagram is followed by the verbatim source that produced it.

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
