"""Check standalone SVG output from an installed MarkFeyn console script."""

import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree

with TemporaryDirectory() as directory:
    output = Path(directory) / "diagram.svg"
    subprocess.run(
        [sys.argv[1], "render", "-", "-o", str(output)],
        input="plain a->b\nlabel a:\\frac{1}{2}\n",
        text=True,
        check=True,
        cwd=directory,
    )
    svg = ElementTree.parse(output).getroot()

assert svg.tag == "{http://www.w3.org/2000/svg}svg"
assert svg.find("{*}style") is not None
math = svg.find(".//{*}svg[@class='feynman-diagram__label-math-svg']")
assert math is not None and math.find(".//{*}path") is not None
assert not math.findall(".//{*}use")
