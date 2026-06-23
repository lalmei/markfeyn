# Emission

Each rendered diagram is followed by the verbatim source that produced it.

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

Source:
