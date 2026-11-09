import sys
from pathlib import Path
import pytest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from gesture_classifier import GestureClassifier

def hand(opened=True,pinch=False):
    p=[[.5,.8,0] for _ in range(21)]; p[0]=[.5,.8,0]
    # spread finger positions and elevated tips for open fingers
    for base,tip,x in [(5,8,.35),(9,12,.45),(13,16,.55),(17,20,.65)]:
        p[base]=[x,.6,0]; p[base+1]=[x,.48,0]; p[base+2]=[x,.36 if opened else .54,0]; p[tip]=[x,.2 if opened else .58,0]
    p[4]=[.23,.48,0]; p[5]=[.35,.6,0]
    if pinch and opened: p[4]=[.5,.2,0]; p[8]=[.51,.2,0]
    elif pinch: p[4]=[.36,.58,0]; p[8]=[.35,.58,0]
    return p

def classify(hands,frames=4):
 c=GestureClassifier(smooth_frames=1)
 out=None
 for _ in range(frames): out=c.update(hands)
 return out

def test_open_palm_is_cursor_only():
    result = classify([hand()])
    assert result.gesture == 'open_palm'
    assert result.rotation == (0.0, 0.0)

def test_open_palm_movement_produces_no_camera_rotation_delta():
    c=GestureClassifier(smooth_frames=1)
    first=hand(); moved=hand()
    for point in moved:
        point[0] += .04
    first_result = c.update([first])
    assert first_result.gesture == 'open_palm' and first_result.cursor is not None
    assert first_result.rotation == (0.0, 0.0)
    result = c.update([moved])
    assert result.gesture == 'open_palm'
    assert result.cursor != first_result.cursor
    assert result.rotation == (0.0, 0.0)

def test_closed_fist(): assert classify([hand(False)]).gesture=='fist'
def test_closed_fist_with_thumb_and_index_close_is_not_misclassified_as_pinch():
 c=GestureClassifier(smooth_frames=1)
 result=c.update([hand(False,pinch=True)])
 assert result.gesture=='fist' and result.cursor is None
def test_closed_fist_movement_emits_relative_rotation_only():
 c=GestureClassifier(smooth_frames=1)
 first=hand(False); moved=hand(False)
 for point in moved:
  point[0]+=.04
  point[1]-=.03
 start=c.update([first]); drag=c.update([moved])
 assert start.gesture=='fist' and start.cursor is None
 assert drag.gesture=='fist' and drag.cursor is None
 assert drag.rotation==pytest.approx((.04,-.03))
 assert drag.zoom==0.0
def test_pinch_and_release():
 c=GestureClassifier(smooth_frames=1); assert c.update([hand(pinch=True)]).gesture=='pinch'; assert c.update([hand()]).gesture=='open_palm'
def test_two_hand_priority():
 c=GestureClassifier(smooth_frames=1)
 result=c.update([hand(),hand()])
 assert result.gesture=='zoom' and result.cursor is None and result.rotation==(0.0,0.0)
def test_two_hand_separation_increase_and_decrease_produce_zoom_deltas():
 c=GestureClassifier(smooth_frames=1)
 first=hand(); second=hand()
 for point in second: point[0]+=.3
 c.update([first,second])
 farther=hand()
 second_farther=hand()
 for point in second_farther: point[0]+=.35
 zoom_in=c.update([farther,second_farther])
 second_closer=hand()
 for point in second_closer: point[0]+=.3
 zoom_out=c.update([farther,second_closer])
 assert zoom_in.gesture=='zoom' and zoom_in.zoom>0
 assert zoom_out.gesture=='zoom' and zoom_out.zoom<0
def test_neutral(): assert classify([]).gesture=='neutral'
def test_tracking_loss():
 c=GestureClassifier(smooth_frames=1); c.update([hand()]); assert c.update([]).tracking=='lost'
def test_invalid_landmarks(): assert classify([[ [0,0,0] ]]).gesture=='neutral'


def test_pinch_state_transitions():
    c=GestureClassifier(smooth_frames=1)
    assert c.update([hand(pinch=True)]).pinch=='pressed'
    assert c.update([hand(pinch=True)]).pinch=='dragging'
    assert c.update([hand()]).pinch=='released'

def test_tracking_loss_prevents_resume_jump():
    c=GestureClassifier(smooth_frames=1)
    first=hand(); resumed=hand()
    for p in resumed: p[0]=min(1,p[0]+.35)
    c.update([first]); lost=c.update([]); after=c.update([resumed])
    assert lost.rotation==(0.0,0.0) and after.rotation==(0.0,0.0)

def test_tracking_loss_during_fist_drag_releases_without_reacquisition_jump():
    c=GestureClassifier(smooth_frames=1)
    first=hand(False); moved=hand(False); resumed=hand(False)
    for point in moved: point[0]+=.04
    for point in resumed: point[0]+=.35
    c.update([first])
    drag=c.update([moved])
    lost=c.update([])
    after=c.update([resumed])
    assert drag.rotation[0]>0 and drag.cursor is None
    assert lost.tracking=='lost' and lost.rotation==(0.0,0.0)
    assert after.gesture=='fist' and after.rotation==(0.0,0.0) and after.cursor is None


def test_temporal_smoothing_requires_repeated_label():
    c=GestureClassifier(smooth_frames=3)
    assert c.update([hand()]).gesture=='neutral'
    assert c.update([hand()]).gesture=='open_palm'


def test_stationary_fist_produces_no_drift_or_rotation():
    c = GestureClassifier(smooth_frames=1)
    h1 = hand(False)
    # Tiny sensor jitter under deadband threshold
    h2 = hand(False)
    for p in h2:
        p[0] += 0.0015
        p[1] -= 0.001
    c.update([h1])
    stationary = c.update([h2])
    assert stationary.gesture == 'fist'
    assert stationary.rotation == (0.0, 0.0)


def test_continuous_fist_drag_across_frames():
    c = GestureClassifier(smooth_frames=1)
    frames = [hand(False) for _ in range(4)]
    for i, f in enumerate(frames):
        for p in f:
            p[0] += i * 0.03
            p[1] -= i * 0.02
    res0 = c.update([frames[0]])
    assert res0.gesture == 'fist' and res0.rotation == (0.0, 0.0)
    res1 = c.update([frames[1]])
    assert res1.gesture == 'fist' and res1.rotation == pytest.approx((0.03, -0.02))
    res2 = c.update([frames[2]])
    assert res2.gesture == 'fist' and res2.rotation == pytest.approx((0.03, -0.02))
    res3 = c.update([frames[3]])
    assert res3.gesture == 'fist' and res3.rotation == pytest.approx((0.03, -0.02))


def test_brief_neutral_transition_does_not_break_fist_drag_or_cause_jump():
    c = GestureClassifier(smooth_frames=2)
    fist1 = hand(False)
    fist2 = hand(False)
    for p in fist2:
        p[0] += 0.03

    # Establish fist drag
    c.update([fist1])
    c.update([fist1])
    drag1 = c.update([fist2])
    assert drag1.gesture == 'fist' and drag1.rotation[0] > 0

    # Brief neutral frame while hand moves slightly
    neutral_hand = [[0.0, 0.0, 0.0] for _ in range(21)]  # invalid/neutral landmarks
    # Instead of invalid landmarks, a hand with neutral shape (2 fingers extended)
    neutral_posture = hand()
    neutral_posture[12] = [0.45, 0.54, 0]  # curl middle
    neutral_posture[16] = [0.55, 0.54, 0]  # curl ring
    # Update position
    for p in neutral_posture:
        p[0] += 0.04
    neu = c.update([neutral_posture])
    assert neu.rotation == (0.0, 0.0)

    # Return to fist with further movement
    fist3 = hand(False)
    for p in fist3:
        p[0] += 0.05
    resumed = c.update([fist3])
    # Delta should be relative to previous hand position, not accumulated from beginning
    assert resumed.rotation[0] < 0.05


def test_opening_hand_releases_fist_drag_and_stops_rotation():
    c = GestureClassifier(smooth_frames=1)
    fist1 = hand(False)
    fist2 = hand(False)
    for p in fist2:
        p[0] += 0.04
    c.update([fist1])
    drag = c.update([fist2])
    assert drag.gesture == 'fist' and drag.rotation[0] > 0

    # Open hand to palm
    palm = hand(opened=True)
    res = c.update([palm])
    assert res.gesture == 'open_palm'
    assert res.rotation == (0.0, 0.0)
    assert res.cursor is not None


def test_tight_fist_facing_camera_is_classified_as_fist_and_not_pinch():
    # When knuckles face camera, PIP is foreshortened closer to MCP than TIP in 2D image coordinates.
    # The classifier must use wrist distance so this is classified as a fist, not pinch.
    c = GestureClassifier(smooth_frames=1)
    pts = [[0.5, 0.7, 0.0] for _ in range(21)]
    pts[5] = [0.42, 0.52, 0.0]; pts[9] = [0.48, 0.50, 0.0]; pts[13] = [0.54, 0.51, 0.0]; pts[17] = [0.60, 0.54, 0.0]
    # Curled fingers where TIP (0.56) is further from MCP (0.52) than PIP (0.50) is
    pts[6] = [0.42, 0.50, 0.0]; pts[7] = [0.42, 0.53, 0.0]; pts[8] = [0.42, 0.56, 0.0]
    pts[10] = [0.48, 0.48, 0.0]; pts[11] = [0.48, 0.52, 0.0]; pts[12] = [0.48, 0.55, 0.0]
    pts[14] = [0.54, 0.49, 0.0]; pts[15] = [0.54, 0.53, 0.0]; pts[16] = [0.54, 0.56, 0.0]
    pts[18] = [0.60, 0.52, 0.0]; pts[19] = [0.60, 0.56, 0.0]; pts[20] = [0.60, 0.58, 0.0]
    # Thumb curled close to index (pinch_ratio is small)
    pts[1] = [0.47, 0.65, 0.0]; pts[2] = [0.45, 0.60, 0.0]; pts[3] = [0.44, 0.56, 0.0]; pts[4] = [0.43, 0.54, 0.0]
    res = c.update([pts])
    assert res.gesture == 'fist'
    assert res.cursor is None


def test_closed_palm_with_thumb_out_is_classified_as_fist():
    c = GestureClassifier(smooth_frames=1)
    # Closed palm with all 4 main fingers curled, thumb extended out
    fist = hand(False)
    fist[4] = [0.15, 0.50, 0.0]  # thumb out
    res = c.update([fist])
    assert res.gesture == 'fist'
    assert res.cursor is None


def test_slow_fist_drag_preserves_movement_and_does_not_drop_deltas():
    c = GestureClassifier(smooth_frames=1)
    fist1 = hand(False)
    c.update([fist1])
    # Subtle intentional drag above deadband (e.g. 0.005)
    fist2 = hand(False)
    for p in fist2:
        p[0] += 0.005
    res = c.update([fist2])
    assert res.gesture == 'fist'
    assert res.rotation[0] == pytest.approx(0.005)
