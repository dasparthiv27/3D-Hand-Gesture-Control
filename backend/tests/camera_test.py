from pathlib import Path
import argparse, sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hand_tracker import run
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera", type=int, default=0)
    try:
        run("camera", parser.parse_args().camera)
    except RuntimeError as exc:
        raise SystemExit(f"ERROR: {exc}") from exc
