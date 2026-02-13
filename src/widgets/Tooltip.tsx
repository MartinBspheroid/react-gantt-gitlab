// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import './Tooltip.css';

function Tooltip(props) {
  const { api, content: Content, children } = props;

  const areaRef = useRef(null);
  const tooltipNodeRef = useRef(null);

  const [areaCoords, setAreaCoords] = useState({});
  const [tooltipData, setTooltipData] = useState(null);
  const [pos, setPos] = useState({});

  function findAttribute(node) {
    while (node) {
      if (node.getAttribute) {
        const id = node.getAttribute('data-tooltip-id');
        const at = node.getAttribute('data-tooltip-at');
        const tooltip = node.getAttribute('data-tooltip');
        if (id || tooltip) return { id, tooltip, target: node, at };
      }
      node = node.parentNode;
    }

    return { id: null, tooltip: null, target: null, at: null };
  }

  useEffect(() => {
    const tooltipNode = tooltipNodeRef.current;
    if (tooltipNode && pos && (pos.text || Content)) {
      const tooltipCoords = tooltipNode.getBoundingClientRect();

      let updated = false;
      let newLeft = pos.left;
      let newTop = pos.top;

      if (tooltipCoords.right >= areaCoords.right) {
        newLeft = areaCoords.width - tooltipCoords.width - 5;
        updated = true;
      }
      if (tooltipCoords.bottom >= areaCoords.bottom) {
        newTop = pos.top - (tooltipCoords.bottom - areaCoords.bottom + 2);
        updated = true;
      }

      if (updated) {
        setPos((prev) => {
          if (!prev) return prev;
          return { ...prev, left: newLeft, top: newTop };
        });
      }
    }
  }, [pos, areaCoords, Content]);

  const timerRef = useRef(null);
  const TIMEOUT = 300;
  const debounce = (code) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      code();
    }, TIMEOUT);
  };

  function move(e) {
    let { id, tooltip, target, at } = findAttribute(e.target);
    setPos(null);
    setTooltipData(null);

    if (!tooltip) {
      if (!id) {
        clearTimeout(timerRef.current);
        return;
      } else {
        tooltip = getTaskText(id);
      }
    }

    const clientX = e.clientX;

    debounce(() => {
      if (id) {
        setTooltipData(getTaskObj(prepareId(id)));
      }

      const targetCoords = target.getBoundingClientRect();
      const areaEl = areaRef.current;
      const areaRect = areaEl
        ? areaEl.getBoundingClientRect()
        : { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };

      let top, left;
      if (at === 'left') {
        top = targetCoords.top + 5 - areaRect.top;
        left = targetCoords.right + 5 - areaRect.left;
      } else {
        top = targetCoords.top + targetCoords.height - areaRect.top;
        left = clientX - areaRect.left;
      }

      setAreaCoords(areaRect);
      setPos({ top, left, text: tooltip });
    });
  }

  function getTaskObj(id) {
    return api?.getTask(prepareId(id)) || null;
  }

  function getTaskText(id) {
    return getTaskObj(id)?.text || '';
  }

  function prepareId(id) {
    const numId = parseInt(id);
    return isNaN(numId) ? id : numId;
  }

  return (
    <div
      className="wx-KG0Lwsqo wx-tooltip-area"
      ref={areaRef}
      onMouseMove={move}
    >
      {pos && (pos.text || Content) ? (
        <div
          className="wx-KG0Lwsqo wx-gantt-tooltip"
          ref={tooltipNodeRef}
          style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
        >
          {Content ? (
            <Content data={tooltipData} />
          ) : pos.text ? (
            <div className="wx-KG0Lwsqo wx-gantt-tooltip-text">{pos.text}</div>
          ) : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}

export default Tooltip;
