import { useState, useMemo } from 'react';
import { getData } from '../data';
import { Gantt, ContextMenu, Toolbar, Editor } from '../../src/';
import { Segmented, Locale } from '@svar-ui/react-core';
import { cn } from '@svar-ui/gantt-locales';
import { cn as cnCore } from '@svar-ui/core-locales';
import './GanttLocale.css';

function GanttLocale({ skinSettings }) {
  const langs = [
    { id: 'en', label: 'EN' },
    { id: 'cn', label: 'CN' },
  ];
  const [lang, setLang] = useState('en');

  return (
    <div className="wx-ycv5Oz8L rows">
      <div className="wx-ycv5Oz8L bar">
        <Segmented
          options={langs}
          value={lang}
          onChange={({ value }) => setLang(value)}
        />
      </div>
      {lang === 'en' && <GanttWidget skinSettings={skinSettings} />}
      {lang === 'cn' && (
        <Locale words={{ ...cn, ...cnCore }}>
          <GanttWidget skinSettings={skinSettings} />
        </Locale>
      )}
    </div>
  );
}

function GanttWidget(props) {
  const { skinSettings } = props;

  const [api, setApi] = useState(null);
  const data = useMemo(() => getData(), []);

  return (
    <>
      <Toolbar api={api} />
      <div className="wx-ycv5Oz8L gtcell">
        <ContextMenu api={api}>
          <Gantt
            {...skinSettings}
            tasks={data.tasks}
            links={data.links}
            scales={data.scales}
            init={setApi}
          />
        </ContextMenu>
        {api && <Editor api={api} />}
      </div>
    </>
  );
}

export default GanttLocale;
