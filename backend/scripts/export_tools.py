"""Export the tool catalog for the frontend.

    python -m scripts.export_tools ../frontend/src/data/tools.json

The frontend builds its static, SEO-friendly pages from this file; availability
(installed engines) is still checked live through the API.
"""

import json
import sys
from pathlib import Path

from app.tools import CATEGORY_LABELS, TOOLS


def main(dest: str) -> None:
    tools = []
    for t in TOOLS.values():
        data = t.public()
        data.pop("available")
        tools.append(data)
    payload = {"categories": [{"id": k, "label": v} for k, v in CATEGORY_LABELS.items()], "tools": tools}
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    Path(dest).write_text(json.dumps(payload, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Exported {len(tools)} tools to {dest}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "../frontend/src/data/tools.json")
