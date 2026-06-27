# Vertices

Each rendered diagram is followed by the verbatim source that produced it.

You also can several choices of the vertex shapes, and fills



=== "empty-dot"


    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    vertex v1:empty-dot
    label q:q q2:q g:g
    ```



=== "dot"


    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    vertex v1:dot
    label q:q q2:q g:g
    ```



=== "blob"


    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    vertex v1:blob
    label q:q q2:q g:g
    ```


=== "disk-hatched"


    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    vertex v1:disk[hatch="diagonal"]
    label q:q q2:q g:g
    ```


=== "disk-hatched-vertical"


    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    vertex v1:disk[hatch="vertical"]
    label q:q q2:q g:g
    ```


=== "disk-hatched-grid"


    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    vertex v1:disk[hatch="grid"]
    label q:q q2:q g:g
    ```


=== "blob-ellipse"


    ```feynman
    size small
    incoming q
    outgoing q2 g
    fermion q->v1 v1->q2
    gluon v1->g
    vertex v1:blob[hatch="horizontal",width=72,height=32]
    label q:q q2:q g:g
    ```

## Mixed Vertex Shapes

You can also mix them together, including endpoint


````markdown
```feynman
fermion a->v v->b
photon v->blob blob->c
scalar blob->d
vertex v:dot blob:blob a:empty-dot
label a:e^- b:e^- c:\gamma d:H
```
````

```feynman
fermion a->v v->b
photon v->blob blob->c
scalar blob->d
vertex v:dot blob:blob a:empty-dot
label a:e^- b:e^- c:\gamma d:H
```
