import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cursor_controller import CursorController

def test_normalization_and_edges():
 c=CursorController(smoothing=1); assert c.update((2,-1),'idle')['cursor']==(1.,0.)
def test_press_release_events():
 c=CursorController(); assert c.update((.1,.2),'pressed')['event']=='press'; assert c.update((.2,.3),'idle')['event']=='release'
