# ELK Processor Evaluation for Milestone 4

Milestone 4 evaluated whether MarkFeyn needs a custom ELK processor for
multi-loop Feynman diagrams.

## Evidence

Two representative two-loop fixtures were run through the semantic multiloop
candidate path:

| Fixture | Detected topology | Selected candidate | Score | Recognizability penalty | Region-overlap penalty |
| --- | --- | --- | ---: | ---: | ---: |
| Nested two-loop region | `multiLoop`, `nested` | `multiloop:nested:canonical` | 0 | 0 | 0 |
| Overlapping two-loop region | `multiLoop`, `overlapping` | `multiloop:overlapping:canonical` | 0 | 0 | 0 |

The debug profile for both fixtures includes the expected semantic stages:
`semantic`, `validation`, `topology`, `orientation`, `external-order`,
`port-constraints`, `parallel-edges`, `symmetric-unclassified`, `multiloop`,
`layout`, and `score`.

## Decision

No custom ELK processor is needed for Milestone 4.

The useful Feynman-specific work is already expressible in MarkFeyn's domain
layer:

- topology analysis identifies biconnected components, bridges, articulation
  vertices, loop regions, and nested/overlapping/disjoint multi-loop sub-kinds;
- bounded semantic candidates place two-loop regions before ELK is asked to
  handle generic graph geometry;
- scoring can reject or penalize collapsed loops, region overlap, containment
  violations, and incremental instability without relying on ELK internals.

ELK remains valuable as a coarse fallback for ordinary tree/scattering
remainder geometry and for cases outside the bounded multi-loop candidate set.
Keeping Feynman semantics outside ELK preserves deterministic behavior and
avoids coupling physics conventions to version-sensitive ELK internals.

## Remaining limits

MarkFeyn still uses heuristics for higher-order multi-loop diagrams and
arbitrary vacuum packing. If future fixtures show repeated failures that cannot
be represented as semantic constraints, candidates, or scoring terms, a custom
ELK processor can be reconsidered with those failures as concrete evidence.
