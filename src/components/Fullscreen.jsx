import { useEffect, useRef, useState } from 'react';
import IconButton from '../widgets/IconButton.jsx';
import { hotkeys } from '../helpers/hotkey';
import './Fullscreen.css';

function Fullscreen({ hotkey = null, children }) {
  const nodeRef = useRef(null);
  const [inFullscreen, setInFullscreen] = useState(false);
  const inFullscreenRef = useRef(inFullscreen);

  useEffect(() => {
    inFullscreenRef.current = inFullscreen;
  }, [inFullscreen]);

  const toggleFullscreen = useRef(() => {
    const node = nodeRef.current;
    const mode = !inFullscreenRef.current;

    if (mode && node) {
      node.requestFullscreen();
    } else if (inFullscreenRef.current) {
      document.exitFullscreen();
    }
    setInFullscreen(mode);
  });

  useEffect(() => {
    if (hotkey)
      hotkeys.subscribe((v) => v.add(hotkey, toggleFullscreen.current));
  }, []);

  useEffect(() => {
    const setFullscreenState = () => {
      setInFullscreen(document.fullscreenElement === nodeRef.current);
    };
    document.addEventListener('fullscreenchange', setFullscreenState, {
      passive: true,
    });
    return () => {
      document.removeEventListener('fullscreenchange', setFullscreenState);
    };
  }, []);

  return (
    <div tabIndex={0} className="wx-KG2RkQhB wx-fullscreen" ref={nodeRef}>
      {children}
      <div className="wx-KG2RkQhB wx-fullscreen-icon">
        <IconButton
          appearance={'transparent'}
          icon={`wxi-${inFullscreen ? 'collapse' : 'expand'}`}
          onClick={() => toggleFullscreen.current()}
        />
      </div>
    </div>
  );
}

export default Fullscreen;
