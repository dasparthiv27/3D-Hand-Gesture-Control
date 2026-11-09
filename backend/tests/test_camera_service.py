import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import hand_tracker

class FakeCapture:
    def __init__(self,*args): self.released=False
    def isOpened(self): return False
    def release(self): self.released=True

class FakeCV2:
    CAP_V4L2=0
    def __init__(self): self.capture=None
    def VideoCapture(self,*args): self.capture=FakeCapture(); return self.capture

def test_camera_open_failure_is_clear(monkeypatch):
    fake=FakeCV2(); monkeypatch.setattr(hand_tracker,'cv2',fake)
    with pytest.raises(RuntimeError,match='Cannot open camera index 3'):
        hand_tracker.open_camera(3)
    assert fake.capture.released

def test_model_missing_is_reported(monkeypatch,tmp_path):
    monkeypatch.setattr(hand_tracker,'MODEL',tmp_path/'missing.task')
    with pytest.raises(RuntimeError,match='MediaPipe model file is missing'):
        hand_tracker.load_detector()
