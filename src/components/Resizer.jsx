import { useState, useMemo, useRef, useCallback } from 'react';
import { useWritableProp } from '@svar-ui/lib-react';
import './Resizer.css';

function Resizer(props) {
  const {
    position = 'after',
    size = 4,
    dir = 'x',
    minValue = 0,
    maxValue = 0,
    onMove,
    onDisplayChange,
    compactMode,
  } = props;

  const [value, setValue] = useWritableProp(props.value ?? 0);
  const [display, setDisplay] = useWritableProp(props.display ?? 'all');

  function getBox(val) {
    let offset = 0;
    if (position == 'center') offset = size / 2;
    else if (position == 'before') offset = size;

    const box = {
      size: [size + 'px', 'auto'],
      p: [val - offset + 'px', '0px'],
      p2: ['auto', '0px'],
    };

    if (dir != 'x') {
      for (let name in box) box[name] = box[name].reverse();
    }
    return box;
  }

  const [active, setActive] = useState(false);

  const startRef = useRef(0);
  const posRef = useRef();

  function getEventPos(ev) {
    return dir == 'x' ? ev.clientX : ev.clientY;
  }

  const move = useCallback((ev) => {
    const newPos = posRef.current + getEventPos(ev) - startRef.current;
    if (
      (!minValue || minValue <= newPos) &&
      (!maxValue || maxValue >= newPos)
    ) {
      setValue(newPos);
      onMove(newPos);
    }
  }, []);

  const up = useCallback(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setActive(false);
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  }, [move]);

  const cursor = useMemo(
    () => (display !== 'all' ? 'auto' : dir == 'x' ? 'ew-resize' : 'ns-resize'),
    [display, dir],
  );

  const down = useCallback(
    (ev) => {
      startRef.current = getEventPos(ev);

      posRef.current = value;
      setActive(true);

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';

      window.addEventListener('mousemove', move, { passive: true });
      window.addEventListener('mouseup', up, { passive: true });
    },
    [cursor, move, up, value],
  );

  function handleExpandLeft() {
    let newDisplay;
    if (compactMode) {
      newDisplay = display === 'chart' ? 'grid' : 'chart';
    } else {
      newDisplay = display === 'all' ? 'chart' : 'all';
    }
    setDisplay(newDisplay);
    onDisplayChange(newDisplay);
  }

  function handleExpandRight() {
    let newDisplay;
    if (compactMode) {
      newDisplay = display === 'grid' ? 'chart' : 'grid';
    } else {
      newDisplay = display === 'all' ? 'grid' : 'all';
    }
    setDisplay(newDisplay);
    onDisplayChange(newDisplay);
  }

  const b = useMemo(() => getBox(value), [value, position, size, dir]);

  const rootClassName = [
    'wx-resizer',
    `wx-resizer-${dir}`,
    `wx-resizer-display-${display}`,
    active ? 'wx-resizer-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={'wx-pFykzMlT ' + rootClassName}
      onMouseDown={down}
      style={{ width: b.size[0], height: b.size[1], cursor }}
    >
      <div className="wx-pFykzMlT wx-button-expand-box">
        <div className="wx-pFykzMlT wx-button-expand-content wx-button-expand-left">
          <i
            className="wx-pFykzMlT wxi-menu-left"
            onClick={handleExpandLeft}
          ></i>
        </div>
        <div className="wx-pFykzMlT wx-button-expand-content wx-button-expand-right">
          <i
            className="wx-pFykzMlT wxi-menu-right"
            onClick={handleExpandRight}
          ></i>
        </div>
      </div>
      <div className="wx-pFykzMlT wx-resizer-line"></div>
    </div>
  );
}

export default Resizer;
