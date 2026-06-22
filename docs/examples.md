# Examples

Each rendered diagram is followed by the verbatim source that produced it.

## Electron-Positron Scattering

```feynman
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
fermion i2->v1 v2->o2
label i1:e^- i2:e^+ o1:μ^{-} o2:μ⁺ v1->v2:γ
```

Source:

````markdown
```feynman
incoming i1 i2
outgoing o1 o2
fermion i1->v1 v2->o1
photon v1->v2
fermion i2->v1 v2->o2
label i1:e⁻ i2:e⁺ o1:μ⁻ o2:μ⁺ v1->v2:γ
```
````

## Scalar Exchange

```feynman
incoming a b
outgoing c d
scalar a->v1 v2->c
scalar b->v1 v2->d
scalar v1->v2
label a:ϕ b:ϕ c:ϕ d:ϕ v1->v2:H
```

Source:

````markdown
```feynman
incoming a b
outgoing c d
scalar a->v1 v2->c
scalar b->v1 v2->d
scalar v1->v2
label a:ϕ b:ϕ c:ϕ d:ϕ v1->v2:H
```
````

## Gluon Emission

```feynman
incoming q
outgoing q2 g
fermion q->v1 v1->q2
gluon v1->g
label q:q q2:q g:g
```

Source:

````markdown
```feynman
incoming q
outgoing q2 g
fermion q->v1 v1->q2
gluon v1->g
label q:q q2:q g:g
```
````

## Mixed Vertex

```feynman
incoming q g
outgoing q2 h
fermion q->v1 v2->q2
gluon g->v1
photon v1->v2
scalar v2->h
label q:q g:g q2:q h:H v1->v2:γ
```

Source:

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

## Vertex Shapes

```feynman
incoming a
outgoing b c d
fermion a->v v->b
photon v->blob blob->c
scalar blob->d
vertex v:dot blob:blob a:empty-dot
label a:e^- b:e^- c:\gamma d:H
```

Source:

````markdown
```feynman
incoming a
outgoing b c d
fermion a->v v->b
photon v->blob blob->c
scalar blob->d
vertex v:dot blob:blob a:empty-dot
label a:e^- b:e^- c:\gamma d:H
```
````

## Layout Algorithms

The same decay can be drawn with different automatic layouts.

```feynman
layout layered
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
layout layered
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
layout spring
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
orientation vertical
size small
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
orientation vertical
size small
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
layout spring
size small
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
size small
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

## Loops

These examples rely on automatic layout only; no `position` commands are used.

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
incoming gamma1
outgoing gamma2
photon gamma1->a b->gamma2
fermion a->b[half left, momentum=k] b->a[half left, momentum'=k-p]
label gamma1:\gamma gamma2:\gamma
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

## Box Diagram

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
````

## Published Recent Paper Diagrams

These examples are schematic reproductions of diagrams that appear in recent
arXiv papers. Each entry names the source figure or equation and notes any
simplification made to express it in MarkFeyn.

### Higher-Trace Dash-Cut Definition

Recreated from the dash-cut definition in Eq. (4.7) of
[arXiv:2606.18929](https://arxiv.org/abs/2606.18929). The source diagram is a
four-leg contact disk with a vertical dashed cut. MarkFeyn uses a shaded disk
instead of the original hatched TikZ fill.

```feynman
options width=560 height=360
position o1 80 95
position o2 80 265
position disk 280 180
position cutTop 280 45
position cutBottom 280 315
position o3 480 95
position o4 480 265
plain o1->disk o2->disk disk->o3 disk->o4
ghost cutBottom->cutTop
vertex disk:disk
```

Source:

````markdown
```feynman
options width=560 height=360
position o1 80 95
position o2 80 265
position disk 280 180
position cutTop 280 45
position cutBottom 280 315
position o3 480 95
position o4 480 265
plain o1->disk o2->disk disk->o3 disk->o4
ghost cutBottom->cutTop
vertex disk:disk
```
````

### Large-N Current Two-Point Function

Recreated from Figure 1 of
[arXiv:2606.19420](https://arxiv.org/abs/2606.19420). The source figure shows
the large `N` current two-point function as a planar disk contribution equal to
a sum over single-meson exchanges. Circular boundary arrows on the original
disk are simplified to a shaded disk.

```feynman
options width=860 height=230
position jl 100 115
position jllabel 100 105
position disk 240 115
position jr 380 115
position jrlabel 380 105
position eq 440 115
position sum 515 115
position f1 640 115
position f1label 640 105
position f2 760 115
position f2label 760 105
position tail 825 115
plain jl->disk disk->jr f1->f2[edge label=n] f2->tail
vertex jl:cross disk:disk jr:cross f1:cross f2:cross
label jllabel:J_V jrlabel:J_V eq:= sum:∑_n f1label:f_n f2label:f_n tail:+...
```

Source:

````markdown
```feynman
options width=860 height=230
position jl 100 115
position jllabel 100 105
position disk 240 115
position jr 380 115
position jrlabel 380 105
position eq 440 115
position sum 515 115
position f1 640 115
position f1label 640 105
position f2 760 115
position f2label 760 105
position tail 825 115
plain jl->disk disk->jr f1->f2[edge label=n] f2->tail
vertex jl:cross disk:disk jr:cross f1:cross f2:cross
label jllabel:J_V jrlabel:J_V eq:= sum:∑_n f1label:f_n f2label:f_n tail:+...
```
````

### Large-N Pion Form Factor

Recreated from Figure 2 of
[arXiv:2606.19420](https://arxiv.org/abs/2606.19420). The source figure shows
the large `N` pion form factor as a planar disk contribution equal to a
single-meson exchange sum. Circular boundary arrows on the original disk are
simplified to a shaded disk.

```feynman
options width=800 height=300
position pi1 80 85
position pi2 80 215
position disk 220 150
position jv 335 150
position eq 395 150
position sum 455 150
position rpi1 530 85
position rpi2 530 215
position g 610 150
position glabel 610 105
position meson 700 150
position tail 755 150
plain pi1->disk pi2->disk disk->jv g->meson[edge label=n] meson->tail[edge label=f_n]
scalar rpi1->g rpi2->g
vertex disk:disk jv:cross g:dot meson:cross
label pi1:\pi pi2:\pi jv:J_V eq:= sum:∑_n rpi1:\pi rpi2:\pi glabel:g_{\pi\pi n} tail:+...
```

Source:

````markdown
```feynman
options width=800 height=300
position pi1 80 85
position pi2 80 215
position disk 220 150
position jv 335 150
position eq 395 150
position sum 455 150
position rpi1 530 85
position rpi2 530 215
position g 610 150
position glabel 610 105
position meson 700 150
position tail 755 150
plain pi1->disk pi2->disk disk->jv g->meson[edge label=n] meson->tail[edge label=f_n]
scalar rpi1->g rpi2->g
vertex disk:disk jv:cross g:dot meson:cross
label pi1:\pi pi2:\pi jv:J_V eq:= sum:∑_n rpi1:\pi rpi2:\pi glabel:g_{\pi\pi n} tail:+...
```
````

### Large-N Pion Amplitude

Recreated from Figure 3 of
[arXiv:2606.19420](https://arxiv.org/abs/2606.19420). The source figure shows
the large `N` pion amplitude as a four-pion planar disk contribution equal to
a single-meson exchange sum. Circular boundary arrows on the original disk are
simplified to a shaded disk.

```feynman
options width=860 height=330
position pi1 90 75
position pi2 90 255
position disk 220 165
position pi3 340 75
position pi4 340 255
position eq 395 165
position sum 470 165
position lpi1 555 85
position lpi2 555 245
position g1 630 165
position g1label 625 120
position g2 735 165
position g2label 740 120
position rpi1 810 85
position rpi2 810 245
position tail 845 165
plain pi1->disk pi2->disk disk->pi3 disk->pi4 g1->g2[edge label=n]
scalar lpi1->g1 lpi2->g1 g2->rpi1 g2->rpi2
vertex disk:disk g1:dot g2:dot
label pi1:\pi pi2:\pi pi3:\pi pi4:\pi eq:= sum:∑_n g1label:g_{\pi\pi n} g2label:g_{\pi\pi n} tail:+...
```

Source:

````markdown
```feynman
options width=860 height=330
position pi1 90 75
position pi2 90 255
position disk 220 165
position pi3 340 75
position pi4 340 255
position eq 395 165
position sum 470 165
position lpi1 555 85
position lpi2 555 245
position g1 630 165
position g1label 625 120
position g2 735 165
position g2label 740 120
position rpi1 810 85
position rpi2 810 245
position tail 845 165
plain pi1->disk pi2->disk disk->pi3 disk->pi4 g1->g2[edge label=n]
scalar lpi1->g1 lpi2->g1 g2->rpi1 g2->rpi2
vertex disk:disk g1:dot g2:dot
label pi1:\pi pi2:\pi pi3:\pi pi4:\pi eq:= sum:∑_n g1label:g_{\pi\pi n} g2label:g_{\pi\pi n} tail:+...
```
````
