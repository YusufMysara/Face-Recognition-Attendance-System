#!/usr/bin/env python3
"""
Export MiniFASNetV2 anti-spoofing model to ONNX for ONNX Runtime Web.

Steps:
    cd backend
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install onnxscript
    python scripts/export_antispoof_onnx.py

The exported file is written to:
    frontend/public/models/antispoof.onnx
"""
import sys
import urllib.request
import importlib.util
from pathlib import Path

RAW = "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master"
MINIFASNET_URL = f"{RAW}/src/model_lib/MiniFASNet.py"
WEIGHTS_URL    = f"{RAW}/resources/anti_spoof_models/2.7_80x80_MiniFASNetV2.pth"

OUT_ONNX = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "public" / "models" / "antispoof.onnx"
)
TMP = Path(__file__).resolve().parent / "_antispoof_tmp"
TMP.mkdir(exist_ok=True)

# ── 1. Download MiniFASNet.py (~20 KB) ───────────────────────────────────────
print("Downloading MiniFASNet.py …")
arch_path = TMP / "MiniFASNet.py"
urllib.request.urlretrieve(MINIFASNET_URL, arch_path)
print(f"  {arch_path.stat().st_size // 1024} KB")

# ── 2. Download weights (~1.8 MB) ────────────────────────────────────────────
print("Downloading model weights …")
weights_path = TMP / "MiniFASNetV2.pth"
urllib.request.urlretrieve(WEIGHTS_URL, weights_path)
size_kb = weights_path.stat().st_size // 1024
print(f"  {size_kb} KB")

if weights_path.stat().st_size < 1_000:
    sys.exit(
        "ERROR: Downloaded weights look like a Git LFS pointer (too small).\n"
        "Download 2.7_80x80_MiniFASNetV2.pth manually from the GitHub repo."
    )

# ── 3. Load model ─────────────────────────────────────────────────────────────
print("Loading model …")
try:
    import torch
except ModuleNotFoundError:
    sys.exit(
        "ERROR: torch is not installed.\n"
        "Run:  pip install torch --index-url https://download.pytorch.org/whl/cpu"
    )

# torch must be imported before MiniFASNet.py is executed so it is already
# present in sys.modules when that file runs its own `import torch`.
spec = importlib.util.spec_from_file_location("MiniFASNet", arch_path)
mod  = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
MiniFASNetV2 = mod.MiniFASNetV2

model = MiniFASNetV2(conv6_kernel=(5, 5))
state = torch.load(weights_path, map_location="cpu")
if any(k.startswith("module.") for k in state):
    state = {k[7:]: v for k, v in state.items()}
model.load_state_dict(state)
model.eval()
print("  Weights loaded.")

# ── 4. Export to ONNX (legacy exporter — weights embedded, no sidecar file) ──
print("Exporting to ONNX …")
OUT_ONNX.parent.mkdir(parents=True, exist_ok=True)
dummy = torch.zeros(1, 3, 80, 80)

torch.onnx.export(
    model,
    dummy,
    str(OUT_ONNX),
    dynamo=False,       # legacy TorchScript exporter: weights embedded inline
    opset_version=17,
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
)

size_kb = OUT_ONNX.stat().st_size // 1024
print(f"\nDone: {OUT_ONNX}  ({size_kb} KB)")
if size_kb < 500:
    print("WARNING: file is smaller than expected — weights may not be embedded.")
else:
    print("Weights are embedded inline. Safe to use in the browser.")

print("\nYou can now uninstall torch:")
print("  pip uninstall torch onnxscript onnx_ir fsspec -y")
