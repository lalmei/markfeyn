const feynman = require("./src/markfeyn/assets/feynman-diagrams.js");

const source = `
layout spring
incoming pi0
outgoing gamma1 gamma2
scalar pi0->t1
fermion t1->t2 t2->t3 t3->t1
photon t2->gamma1 t3->gamma2
invisible gamma1->gamma2
label pi0:\\pi^0 gamma1:\\gamma gamma2:\\gamma
`;

const sourceNoInvisible = `
layout spring
incoming pi0
outgoing gamma1 gamma2
scalar pi0->t1
fermion t1->t2 t2->t3 t3->t1
photon t2->gamma1 t3->gamma2
label pi0:\\pi^0 gamma1:\\gamma gamma2:\\gamma
`;

function report(name, positions) {
  console.log(`\n=== ${name} ===`);
  ["pi0", "t1", "t2", "t3", "gamma1", "gamma2"].forEach((n) => {
    const p = positions[n];
    console.log(`${n.padEnd(7)} x=${p.x.toFixed(1).padStart(7)}  y=${p.y.toFixed(1).padStart(7)}  kind=${p.kind}`);
  });
  const t2 = positions.t2;
  const t3 = positions.t3;
  console.log(`t2->t3 dx=${(t3.x - t2.x).toFixed(1)} dy=${(t3.y - t2.y).toFixed(1)}  (vertical needs dx≈0)`);
  console.log(`photon1 t2->gamma1 dy=${(positions.gamma1.y - t2.y).toFixed(1)} (horizontal needs dy≈0)`);
  console.log(`photon2 t3->gamma2 dy=${(positions.gamma2.y - t3.y).toFixed(1)} (horizontal needs dy≈0)`);
}

(async () => {
  for (const [name, src] of [["WITH invisible", source], ["WITHOUT invisible", sourceNoInvisible]]) {
    const diagram = feynman.parseFeynman(src);
    if (diagram.errors.length) console.log("parse errors", diagram.errors);
    const layout = await feynman.layoutFeynman(diagram);
    report(name, layout.positions);
  }
})();
