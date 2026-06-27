# Edges

Each propagator command draws a different particle line between two endpoints.
Every rendered diagram below is followed by the verbatim source that produced
it.

=== "fermion"


    ```feynman
    size small
    incoming a
    outgoing b
    fermion a->b
    label a:e^- b:e^-
    ```


=== "photon"


    ```feynman
    size small
    incoming a
    outgoing b
    photon a->b
    label a:\gamma b:\gamma
    ```


=== "gluon"


    ```feynman
    size small
    incoming a
    outgoing b
    gluon a->b
    label a:g b:g
    ```


=== "scalar"


    ```feynman
    size small
    incoming a
    outgoing b
    scalar a->b
    label a:\phi b:\phi
    ```


=== "ghost"


    ```feynman
    size small
    incoming a
    outgoing b
    ghost a->b
    label a:c b:c
    ```


=== "dashed"


    ```feynman
    size small
    incoming a
    outgoing b
    dashed a->b
    ```


=== "dot-dashed"


    ```feynman
    size small
    incoming a
    outgoing b
    dot-dashed a->b
    ```


=== "triangle"


    ```feynman
    size small
    incoming a
    outgoing b
    triangle a->b
    ```


=== "square"


    ```feynman
    size small
    incoming a
    outgoing b
    square a->b
    ```


=== "double"


    ```feynman
    size small
    incoming a
    outgoing b
    double a->b
    ```


=== "eikonal"


    ```feynman
    size small
    incoming a
    outgoing b
    eikonal a->b
    ```

## Mixing edge types

The new shapes combine with the existing propagators and vertices just like any
other edge.


````markdown
```feynman
fermion a->v v->b
double v->w[momentum=k]
triangle w->c
square w->d
vertex v:dot w:blob
label a:e^- b:e^- c:\gamma d:H
```
````

```feynman
fermion a->v v->b
double v->w[momentum=k]
triangle w->c
square w->d
vertex v:dot w:blob
label a:e^- b:e^- c:\gamma d:H
```
