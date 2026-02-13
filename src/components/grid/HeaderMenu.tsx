// @ts-nocheck
import { useState, useEffect } from 'react';
import { HeaderMenu as HeaderMenuInner } from '@svar-ui/react-grid';

const HeaderMenu = ({ children, columns = null, api }) => {
  const [tableAPI, setTableAPI] = useState(null);
  useEffect(() => {
    if (!api) return;
    api.getTable(true).then(setTableAPI);
  }, [api]);

  return (
    <HeaderMenuInner api={tableAPI} columns={columns}>
      {children}
    </HeaderMenuInner>
  );
};

export default HeaderMenu;
