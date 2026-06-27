# Scattering & Decays

Each rendered diagram is followed by the verbatim source that produced it.

## Electron-Positron Annihilation

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

## Bhabha Scattering

Tree-level QED \(e^+ e^- \to e^+ e^-\) is conventionally represented by an
s-channel annihilation graph and a t-channel photon-exchange graph. The third
tab uses `layout layered` with `align vertical lower upper` to stack the photon
vertically and cross the outgoing legs. Because `align vertical a b` places `a`
above `b`, listing `lower` first puts it on top, which produces the crossing.

<div class="grid" markdown>
<div markdown>
=== "Annihilation"

    ```feynman
    incoming  e_plus e_minus
    outgoing e_minus_out e_plus_out
    fermion e_minus->ann
    anti fermion e_plus->ann
    photon ann->prod[edge label=\gamma]
    fermion prod->e_minus_out
    anti fermion prod->e_plus_out
    label e_minus:e^- e_plus:e^+ e_minus_out:e^- e_plus_out:e^+
    ```

=== "Exchange"

    ```feynman
    incoming  e_minus  e_plus
    outgoing e_plus_out e_minus_out
    fermion e_minus->upper upper->e_minus_out
    photon upper->lower[edge label=\gamma]
    anti fermion e_plus_out->lower lower->e_plus
    label e_minus:e^- e_plus:e^+ e_minus_out:e^- e_plus_out:e^+
    ```

=== "Crossed vertical"

    ```feynman
    layout layered
    align vertical lower upper
    incoming  e_minus  e_plus
    outgoing    e_minus_out e_plus_out
    fermion e_minus->upper upper->e_minus_out
    photon upper->lower[edge label=\gamma]
    anti fermion e_plus_out->lower lower->e_plus
    label e_minus:e^- e_plus:e^+ e_minus_out:e^- e_plus_out:e^+
    ```

</div>
<div markdown>
=== "Annihilation"

    ````markdown
    ```feynman
    incoming e_minus e_plus
    outgoing e_minus_out e_plus_out
    fermion e_minus->ann
    anti fermion e_plus->ann
    photon ann->prod[edge label=\gamma]
    fermion prod->e_minus_out
    anti fermion prod->e_plus_out
    label e_minus:e^- e_plus:e^+ e_minus_out:e^- e_plus_out:e^+
    ```
    ````

=== "Exchange"

    ````markdown
    ```feynman
    incoming  e_minus  e_plus
    outgoing e_plus_out e_minus_out
    fermion e_minus->upper upper->e_minus_out
    photon upper->lower[edge label=\gamma]
    anti fermion e_plus_out->lower lower->e_plus
    label e_minus:e^- e_plus:e^+ e_minus_out:e^- e_plus_out:e^+
    ```
    ````

=== "Crossed vertical"

    ````markdown
    ```feynman
    options width=330 height=520
    layout layered
    align vertical lower upper
    incoming  e_minus  e_plus
    outgoing    e_minus_out e_plus_out
    fermion e_minus->upper upper->e_minus_out
    photon upper->lower[edge label=\gamma]
    anti fermion e_plus_out->lower lower->e_plus
    label e_minus:e^- e_plus:e^+ e_minus_out:e^- e_plus_out:e^+
    ```
    ````

</div>
</div>

## Drell-Yan Production

This schematic hadron-hadron example uses elliptical blobs and parallel parton
lines for the incoming hadrons, then exposes the hard subprocess
`q qbar -> \gamma*/Z -> l+ l-`. The declared boundary order is clockwise:
incoming nodes run bottom-to-top on the left, and outgoing nodes run top-to-bottom
on the right.

```feynman
options width=760 height=380
incoming h2s2l  h2s1l h2ql h1ql h1s2l  h1s1l
outgoing h1s1r  h1s2r lminus lplus  h2s1r h2s2r
fermion h1s1l->h1s1r[overlay] h1ql->q[overlay] h1s2l->h1s2r[overlay]
anti fermion h2s1l->h2s1r[overlay] h2ql->qbar[overlay] h2s2l->h2s2r[overlay]
align vertical q qbar
anti fermion qbar->ann
fermion q->ann
photon ann->boson[edge label=\gamma^*/Z]
fermion boson->lminus
anti fermion boson->lplus
vertex  ann:dot boson:dot
label q:q qbar:\overline{q} lminus:\ell^- lplus:\ell^+
```

Source:

````markdown
```feynman
options width=760 height=380
incoming h2s2l  h2s1l h2ql h1ql h1s2l  h1s1l
outgoing h1s1r  h1s2r lminus lplus  h2s1r h2s2r
fermion h1s1l->h1s1r[overlay] h1ql->q[overlay] h1s2l->h1s2r[overlay]
anti fermion h2s1l->h2s1r[overlay] h2ql->qbar[overlay] h2s2l->h2s2r[overlay]
align vertical q qbar
anti fermion qbar->ann
fermion q->ann
photon ann->boson[edge label=\gamma^*/Z]
fermion boson->lminus
anti fermion boson->lplus
vertex  ann:dot boson:dot
label q:q qbar:\overline{q} lminus:\ell^- lplus:\ell^+
```
````

## Deep Inelastic Scattering

The DIS example shows a lepton emitting a virtual photon into a quark line
selected from the parallel parton lines inside an elliptical hadron blob.

```feynman
options width=760 height=400
incoming p1l p2l pql lepton_in
outgoing lepton_out jet p2r p1r
fermion  pql->parton[overlay] lepton_in->lepton_vertex
fermion parton->struck
photon lepton_vertex->struck[edge label=\gamma^*]
fermion lepton_vertex->lepton_out
fermion struck->jet
fermion  p2l->p2r[overlay] p1l->p1r[overlay]
label lepton_in:\ell lepton_out:\ell'  parton:q jet:X
```

Source:

````markdown
```feynman
options width=760 height=400
position lepton_in 80 95
position lepton_vertex 300 95
position lepton_out 640 60
position proton 135 285
position p1l 45 255
position p1r 255 255
position pql 45 285
position parton 255 285
position p2l 45 315
position p2r 255 315
position struck 390 250
position jet 640 220
position remnant 640 330
fermion lepton_in->lepton_vertex lepton_vertex->lepton_out
photon lepton_vertex->struck[edge label=\gamma^*]
fermion p1l->p1r[overlay] pql->parton[overlay] p2l->p2r[overlay]
fermion parton->struck struck->jet
plain p2r->remnant
vertex proton:blob[hatch=grid,width=150,height=84] lepton_vertex:dot struck:dot
label lepton_in:\ell lepton_out:\ell' proton:P parton:q jet:X remnant:remnant
```
````

## Scalar Exchange

<div class="grid" markdown>
<div markdown>

````
```feynman
incoming a b
outgoing c d
scalar a->v1 v2->c
scalar b->v1 v2->d
scalar v1->v2
label a:ϕ b:ϕ c:ϕ d:ϕ v1->v2:H
```
````

</div>

```feynman
incoming a b
outgoing c d
scalar a->v1 v2->c
scalar b->v1 v2->d
scalar v1->v2
label a:ϕ b:ϕ c:ϕ d:ϕ v1->v2:H
```

</div>

## Emission

<div class="grid" markdown>
<div markdown>
=== "gluon"

    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    label q:q q2:q g:g
    ```

=== "photon"

    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    photon v1->g
    label q:q q2:q g:g
    ```

</div>
<div markdown>

=== "gluon"

    ```` hl_lines="6"
    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    label q:q q2:q g:g
    ```
    ````

=== "photon"

    ````  hl_lines="6"
    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    photon v1->g
    label q:q q2:q g:g
    ```
    ````

</div>
</div>

## Mixed Vertex

Vertex are user define so you are not confined to the known symmetries of the this universe.

<div class='grid' markdown>

<div markdown>
````markdown
```feynman
incoming q g
outgoing q2 h
fermion q->v1 v2->q2
gluon g->v1
photon v1->v2
scalar v2->h
label q:q g:g q2:q h:H v1->v2:γ
```
````
</div>

```feynman
incoming q g
outgoing q2 h
fermion q->v1 v2->q2
gluon g->v1
photon v1->v2
scalar v2->h
label q:q g:g q2:q h:H v1->v2:γ
```

</div>

## Meson Decay And Mixing

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
