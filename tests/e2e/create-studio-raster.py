"""Inspect synthetic production proofs with Poppler and decode the printed giving QR."""
from pathlib import Path
import json
import re
import subprocess
import cv2
from PIL import Image, ImageOps, ImageDraw
from pypdf import PdfReader

root = Path(__file__).resolve().parents[2]
evidence = root / "docs/status/audit-artifacts/2026-11-03-create-studio"
results = []
for source in sorted(evidence.glob("*.pdf")):
    prefix = evidence / source.stem
    subprocess.run(["pdftoppm", "-r", "85", "-png", str(source), str(prefix)], check=True, capture_output=True)
    text = "\n".join(page.extract_text() for page in PdfReader(source).pages)
    if source.name.startswith("proof-"):
        count = int(source.name.split("-")[1])
        assert all(f"Synthetic page {n}" in text for n in range(1, count + 1))
        assert all(f"Page {n} of {count}" in text for n in range(1, count + 1))
    if source.name == "appeal-letter.pdf":
        assert [int(n) for n in re.findall(r"Gift\s+row\s+(\d+)", text)] == list(range(1, 61))
        assert re.sub(r"\s+", "", text).count("TaylorReed") == 2  # signature and printed name
    images = sorted(path for path in evidence.glob(f"{source.stem}-*.png") if "contact-sheet" not in path.name)
    cards = []
    for path in images:
        image = Image.open(path).convert("RGB")
        image.thumbnail((240, 310))
        card = Image.new("RGB", (260, 340), "#eaf2fb")
        card.paste(image, ((260 - image.width) // 2, 8))
        ImageDraw.Draw(card).text((10, 322), path.stem, fill="#17324f")
        cards.append(card)
    sheet = Image.new("RGB", (260 * min(5, len(cards)), 340 * ((len(cards) + 4) // 5)), "#eaf2fb")
    for index, card in enumerate(cards):
        sheet.paste(card, ((index % 5) * 260, (index // 5) * 340))
    sheet.save(evidence / f"{source.stem}-contact-sheet.png")
    results.append({"file": source.name, "rasterizedPages": len(images), "textRetained": True})

subprocess.run(["pdftoppm", "-f", "1", "-singlefile", "-r", "200", "-png", str(evidence / "appeal-letter.pdf"), str(evidence / "appeal-qr-proof")], check=True, capture_output=True)
image = cv2.imread(str(evidence / "appeal-qr-proof.png"))
decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(image)
assert decoded.startswith("https://example.invalid/give/synthetic?") and "createResponse=synthetic-response-code-fixture" in decoded, decoded
(evidence / "raster-checks.json").write_text(json.dumps({"synthetic": True, "results": results, "printedQrDecoded": decoded}, indent=2))
print(json.dumps({"proofs": len(results), "pages": sum(item["rasterizedPages"] for item in results), "printedQrDecoded": True}))
