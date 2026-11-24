"""Convert permissively licensed artwork into inert path data."""
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree

muscle, flow, opengym = map(Path, sys.argv[1:4])
output = Path("public/open-gym")
corrections = json.loads((Path(__file__).resolve().parents[1] / "features/exercises/catalog-corrections.json").read_text(encoding="utf-8"))
(output / "flow").mkdir(parents=True, exist_ok=True)
(output / "thumb").mkdir(parents=True, exist_ok=True)
converted = json.loads((opengym / "frontend/src/lib/body-paths.js").read_text(encoding="utf-8").split("export default ", 1)[1].strip())
geom = {}
slugs = lambda name: re.sub(r"([A-Z])", lambda match: "-" + match[0].lower(), name)
viewboxes = {
    "male-front": "0 95 727 1280", "male-back": "718 95 727 1280",
    "female-front": "0 0 650 1450", "female-back": "823 0 650 1450",
}
for name, viewbox in viewboxes.items():
    filename = "".join(part.capitalize() for part in name.split("-")) + "Paths.swift"
    text = (muscle / "Sources/MuscleMap/Data" / filename).read_text(encoding="utf-8")
    regions = {}
    for section in re.split(r"BodyPartPathData\(", text)[1:]:
        key = re.search(r"slug: \.(\w+)", section)
        if key:
            regions[slugs(key[1])] = re.findall(r'"([Mm][^"\r\n]*)"', section)
    assert 18 <= len(regions) and all(regions.values())
    if name.endswith("back"):
        indices = [1, 5] if name.startswith("male") else [1, 3]
        back = converted[name.split("-")[0]]["back"]["p"]["upper-back"]
        assert max(indices) < len(back)
        regions["lats"] = [points for i, points in enumerate(back) if i in indices]
        regions["upper-back"] = [points for i, points in enumerate(back) if i not in indices]
    geom[name] = {"viewBox": viewbox, "regions": regions}

def frame(path):
    if "<!ENTITY" in path.read_text(encoding="utf-8").upper():
        raise ValueError("Entities are not allowed")
    doc = ElementTree.parse(path).getroot()
    element = doc.find("{*}g")
    if element is None or not re.fullmatch(r"[\d .+-]+", doc.attrib["viewBox"]):
        raise ValueError("Unexpected frame")
    transform = element.attrib.get("transform", "")
    if not re.fullmatch(r"[a-zA-Z0-9., ()+-]*", transform):
        raise ValueError("Unexpected transform")
    paths = [node.attrib["d"] for node in element if node.tag.endswith("}path")]
    if not paths or not all(re.fullmatch(r"[MmZzLlHhVvCcSsQqTtAaEe\d.,\s+\-]+", item) for item in paths):
        raise ValueError("Unexpected paths")
    return (doc.attrib["viewBox"], {"transform": transform, "paths": paths})

def normalized(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())

def emit(file, value):
    file.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

emit(output / "anatomy.json", geom)
known = []
unmatched = {}
for item in json.loads((flow / "data/exercises.json").read_text(encoding="utf-8")):
    id_ = item["id"]
    if id_ in corrections:
        continue
    animation = item.get("animation")
    if not animation or animation.get("license") != "CC0-1.0":
        continue
    upstream_file = opengym / "catalogue/exercises" / (id_ + ".json")
    if not upstream_file.exists():
        continue
    exercise = json.loads(upstream_file.read_text(encoding="utf-8"))
    if normalized(exercise["name"]) != normalized(item["name"]) or exercise["equipment"] != item["equipment"]:
        unmatched[id_] = [exercise["name"], item["name"]]
        continue
    drawings = [frame(flow / path) for path in animation["frames"]]
    if len({drawing[0] for drawing in drawings}) != 1:
        continue
    emit(output / "flow" / (id_ + ".json"), {
        "viewBox": drawings[0][0], "frames": [drawing[1] for drawing in drawings],
        "sequence": animation["sequence"], "ms": animation["frameDurationMs"],
    })
    box, drawing = drawings[0]
    paths = "".join('<path d="' + path + '" />' for path in drawing["paths"])
    (output / "thumb" / (id_ + ".svg")).write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box +
        '"><g fill="#F4F2ED" transform="' + drawing["transform"] + '">' + paths + "</g></svg>", encoding="utf-8")
    known.append(id_)
emit(output / "animation-ids.json", known)
print("Verified name and equipment against OpenGym:", len(known), "| Different:", len(unmatched))
