# Layout Algorithms

Each rendered diagram is followed by the verbatim source that produced it.

The same decay can be drawn with different automatic layouts.

=== "layered"

    ````
    ```feynman
    layout layered
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```
    ````

=== "spring"

    ````
    ```feynman
    layout spring
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```
    ````

=== "electrical spring"

    ````
    ```feynman
    layout spring electrical
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```
    ````

---

=== "layered"

    ```feynman
    layout layered
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```

=== "spring"

    ```feynman
    layout spring
    incoming mu
    outgoing numu e nue
    fermion mu->w w->numu
    boson w->v
    anti fermion nue->v
    fermion v->e
    label mu:\mu^- numu:\nu_\mu nue:\nu_e e:e^- w->v:W^-
    ```

=== "electrical spring"

    ```feynman
    layout spring electrical
    incoming mu
    outgoing numu e nue
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
