import { useState, useMemo, useCallback } from 'react';
import { getData } from '../data';
import { Gantt } from '../../src/';
import { Button } from '@svar-ui/react-core';
import './GanttCustomSort.css';

export default function GanttCustomSort({ skinSettings }) {
  const data = useMemo(() => getData(), []);

  const [gApi, setGApi] = useState(null);
  const [sortConfig, setSortConfig] = useState({});
  const getIcons = useCallback(() => {
    const obj = { text: '', start: '', duration: '' };
    const { key, order } = sortConfig;
    if (key) obj[key] = `wxi-arrow-${order == 'asc' ? 'up' : 'down'}`;
    return obj;
  }, [sortConfig]);
  const [icons, setIcons] = useState(() => getIcons());

  const sort = useCallback(
    (id) => {
      const { key, order } = sortConfig;
      let newOrder = !key ? 'desc' : 'asc';

      if (key === id) newOrder = order === 'asc' ? 'desc' : 'asc';

      if (gApi) gApi.exec('sort-tasks', { key: id, order: newOrder });
    },
    [gApi, sortConfig],
  );

  const init = useCallback((api) => {
    api.on('sort-tasks', (config) => {
      setSortConfig(config);
      // Compute icons based on the incoming config to mirror Svelte's sequential state updates
      const obj = { text: '', start: '', duration: '' };
      const { key, order } = config;
      if (key) obj[key] = `wxi-arrow-${order == 'asc' ? 'up' : 'down'}`;
      setIcons(obj);
    });
    setGApi(api);
  }, []);

  return (
    <div className="wx-q0L4gF4x rows">
      <div className="wx-q0L4gF4x bar">
        <div className="wx-q0L4gF4x label">Sort by</div>
        <Button onClick={() => sort('text')}>
          Task Name <i className={'wx-q0L4gF4x ' + icons.text}></i>
        </Button>
        <Button onClick={() => sort('start')}>
          Start Date <i className={'wx-q0L4gF4x ' + icons.start}></i>
        </Button>
        <Button onClick={() => sort('duration')}>
          Duration <i className={'wx-q0L4gF4x ' + icons.duration}></i>
        </Button>
      </div>

      <div className="wx-q0L4gF4x gtcell">
        <Gantt
          init={init}
          {...skinSettings}
          tasks={data.tasks}
          links={data.links}
          scales={data.scales}
        />
      </div>
    </div>
  );
}
