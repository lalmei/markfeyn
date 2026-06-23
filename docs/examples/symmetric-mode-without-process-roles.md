# Symmetric Mode Without Process Roles

Each rendered diagram is followed by the verbatim source that produced it.

When a diagram omits `incoming` and `outgoing`, MarkFeyn keeps degree-1
endpoints as unclassified and uses symmetric orientation. Focused refinement
then mirrors balanced two-center trees and symmetric two-point self-energy
loops. This is a heuristic for common no-role diagrams, not a full graph
automorphism engine.

### No-Role Annihilation Tree

Without `incoming` / `outgoing`, endpoints stay unclassified but use the same
left-to-right scattering geometry as the explicit-role version.

<div class="grid" markdown>

```feynman
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\mu^+ mu_minus:\mu^- ann->prod:\gamma
```

<div markdown>

````
```feynman
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\mu^+ mu_minus:\mu^- ann->prod:\gamma
```
````

</div>
</div>

### Explicit Roles Still Use Process Layout

Declaring `incoming` and `outgoing` assigns process roles and ordering metadata,
but the geometry matches the no-role annihilation tree above.

<div class="grid" markdown>

```feynman
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\mu^+ mu_minus:\mu^- ann->prod:\gamma
```

<div markdown>

````
```feynman
incoming e_minus e_plus
outgoing mu_plus mu_minus
fermion e_minus->ann
anti fermion e_plus->ann
photon ann->prod[momentum'=k]
anti fermion prod->mu_plus
fermion prod->mu_minus
label e_minus:e^- e_plus:e^+ mu_plus:\mu^+ mu_minus:\mu^- ann->prod:\gamma
```
````

</div>
</div>

### Even Split (6 unclassified total)

Even **total** unclassified count (here 3→3 per center, six terminals overall): every
external stays on the left or right margin. No top/bottom center leaf.

<div class="grid" markdown>

```feynman
fermion l1->hub1 l2->hub1 l3->hub1
photon hub1->hub2
fermion hub2->r1 hub2->r2 hub2->r3
label l1:a_1 l2:a_2 l3:a_3 r1:b_1 r2:b_2 r3:b_3 hub1->hub2:X
```

<div markdown>

````
```feynman
fermion l1->hub1 l2->hub1 l3->hub1
photon hub1->hub2
fermion hub2->r1 hub2->r2 hub2->r3
label l1:a_1 l2:a_2 l3:a_3 r1:b_1 r2:b_2 r3:b_3 hub1->hub2:X
```
````

</div>
</div>

### Even Split (8 unclassified total)

Another even total (4→4 per center): same margin-only placement.

<div class="grid" markdown>

```feynman
fermion l1->hub1 l2->hub1 l3->hub1 l4->hub1
photon hub1->hub2
fermion hub2->r1 hub2->r2 hub2->r3 hub2->r4
label l1:a_1 l2:a_2 l3:a_3 l4:a_4 r1:b_1 r2:b_2 r3:b_3 r4:b_4 hub1->hub2:X
```

<div markdown>

````
```feynman
fermion l1->hub1 l2->hub1 l3->hub1 l4->hub1
photon hub1->hub2
fermion hub2->r1 hub2->r2 hub2->r3 hub2->r4
label l1:a_1 l2:a_2 l3:a_3 l4:a_4 r1:b_1 r2:b_2 r3:b_3 r4:b_4 hub1->hub2:X
```
````

</div>
</div>

### Odd Split (3 unclassified total)

Odd **total** unclassified count: the median terminal by declaration order is placed
at the top or bottom center; the others stay on the margins.

```feynman
fermion l1->hub1 l2->hub1 l3->hub1
photon hub1->hub2
fermion hub2->r2 hub2->r3
label l1:a_1 l2:a_2 l3:a_3 r2:b_2 r3:b_3 hub1->hub2:X
```

```feynman
fermion l1->hub1 l2->hub1 l3->hub1
fermion hub1->r2 hub1->r3
label l1:a_1 l2:a_2 l3:a_3 r2:b_2 r3:b_3
vertex hub1:blob
```

<div class="grid" markdown>

```feynman
fermion root->a root->b b->c b->d
label a:a c:c d:d
```

<div markdown>

````
```feynman
fermion root->a root->b b->c b->d
label a:a c:c d:d
```
````

</div>
</div>

### No-Role Gamma-to-Gamma Self-Energy Loop

Without `incoming` / `outgoing`, the loop keeps unclassified externals but uses the
same horizontal left-to-right geometry as the explicit-role version.

<div class="grid" markdown>

```feynman
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\gamma gamma2:\gamma
```

<div markdown>

````
```feynman
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\gamma gamma2:\gamma
```
````

</div>
</div>

### Explicit Roles on the Same Loop

Declaring roles assigns process metadata; geometry matches the no-role loop above.

<div class="grid" markdown>

```feynman
layout spring
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\gamma gamma2:\gamma
```

<div markdown>

````
```feynman
layout spring
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\gamma gamma2:\gamma
```
````

</div>
</div>

### Asymmetric Unclassified Tree

When one side has an extra leaf (counts differ by one), the total unclassified count
is odd. The median terminal by declaration order goes to the top or bottom center;
the rest stay on the margins. Refinement is skipped when the per-side mismatch is
larger (for example one leaf on one side and three on the other).

<div class="grid" markdown>

```feynman
fermion root->a root->b b->c b->d b->e
```

<div markdown>

````
```feynman
fermion root->a root->b b->c b->d b->e
```
````

</div>
</div>
