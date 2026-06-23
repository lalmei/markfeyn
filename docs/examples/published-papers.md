# Published Recent Paper Diagrams

Each rendered diagram is followed by the verbatim source that produced it.

These examples are schematic reproductions of diagrams that appear in recent
arXiv papers. Each entry names the source figure or equation and notes any
simplification made to express it in MarkFeyn.

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
