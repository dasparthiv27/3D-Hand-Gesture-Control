class CursorController:
    def __init__(self, smoothing=.35): self.smoothing=max(0,min(1,smoothing)); self.position=None; self.pressed=False
    def update(self, point, pinch_state):
        if point is not None:
            point=(max(0.,min(1.,float(point[0]))),max(0.,min(1.,float(point[1]))))
            self.position=point if self.position is None else tuple((1-self.smoothing)*a+self.smoothing*b for a,b in zip(self.position,point))
        pressed=pinch_state in ('pressed','dragging')
        event='press' if pressed and not self.pressed else 'release' if self.pressed and not pressed else None
        self.pressed=pressed
        return {'cursor':self.position,'pressed':pressed,'event':event}
