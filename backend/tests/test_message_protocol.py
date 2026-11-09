import json
import sys
from pathlib import Path
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from gesture_classifier import GestureResult
from message_protocol import encode_message, gesture_payload, validate_payload

def test_message_serialization_and_normalized_cursor():
    payload = gesture_payload(GestureResult(gesture='pinch', hands=1, cursor=(.25,.8), pinch='pressed', tracking='tracking'))
    parsed = json.loads(encode_message(payload))
    assert parsed['gesture']=='pinch' and parsed['cursor']==[.25,.8]

def test_rotation_deltas_survive_websocket_serialization():
    payload=gesture_payload(GestureResult(gesture='rotate',hands=1,tracking='tracking',rotation=(.04,-.02)))
    parsed=json.loads(encode_message(payload))
    assert parsed['type']=='gesture' and parsed['gesture']=='rotate'
    assert parsed['rotation']==[.04,-.02]

def test_reject_invalid_schema():
    with pytest.raises(ValueError): validate_payload({'type':'gesture','gesture':'bad','hands':1})

def test_reject_out_of_range_cursor():
    payload={'type':'gesture','gesture':'rotate','hands':1,'cursor':[2,.5],'pinch':'idle','tracking':'tracking','rotation':[0,0],'zoom':0}
    with pytest.raises(ValueError): validate_payload(payload)
