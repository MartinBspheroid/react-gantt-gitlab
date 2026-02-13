import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './common/Index.tsx';

import { Globals, Button, Segmented } from '@svar-ui/react-core';

import Willow from '../src/themes/Willow.tsx';
import WillowDark from '../src/themes/WillowDark.tsx';
import Shadcn from '../src/themes/Shadcn.tsx';
import ShadcnDark from '../src/themes/ShadcnDark.tsx';

import '@svar-ui/react-core/style.css';
import '@svar-ui/react-grid/style.css';
import '@svar-ui/react-editor/style.css';
import '@svar-ui/react-menu/style.css';
import '@svar-ui/react-toolbar/style.css';
import '@svar-ui/react-comments/style.css';
import '@svar-ui/react-tasklist/style.css';

const skins = [
  { id: 'willow', label: 'Willow', Component: Willow },
  { id: 'willow-dark', label: 'Dark', Component: WillowDark },
  { id: 'shadcn', label: 'Shadcn', Component: Shadcn },
  { id: 'shadcn-dark', label: 'Shadcn Dark', Component: ShadcnDark },
];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App
      publicName="Gantt"
      skins={skins}
      productTag="gantt"
      Globals={Globals}
      Button={Button}
      Segmented={Segmented}
    />
  </React.StrictMode>,
);
