import { useState, useEffect, useCallback } from 'react';
import { HashRouter, NavLink, useNavigate } from 'react-router-dom';

import Router from './Router';
import { links } from '../routes';
import { LogoIcon } from '../assets/icons';
import './Index.css';

function DemoExplorerContent({
  productTag: _productTag,
  publicName,
  skins,
  Globals,
  Button,
  Segmented,
}) {
  const navigate = useNavigate();
  const [skin, setSkin] = useState(skins[0].id);
  const [title, setTitle] = useState('');
  const [githubLink, setGithubLink] = useState('');
  const [show, setShow] = useState(false);

  const baseLink =
    'https://github.com/nicejji/react-gantt' + '/tree/main/demos/cases/';

  useEffect(() => {
    document.body.className = `wx-willow-theme`;
  }, []);

  const handleRouteChange = useCallback(
    (path) => {
      const parts = path.split('/');
      const page = parts[1];
      const newSkin = parts[2];

      if (newSkin && newSkin !== skin) {
        setSkin(newSkin);
      }

      const targetPage = `/${page}/:skin`;
      const matched = links.find((a) => a[0] === targetPage);
      if (matched) {
        setTitle(matched[1]);
        const name = matched[3] || matched[1];
        setGithubLink(`${baseLink}${name}.jsx`);
      }
    },
    [skin],
  );

  const handleSkinChange = ({ value }) => {
    setSkin(value);
    const currentPath = window.location.hash.slice(1);
    const parts = currentPath.split('/');
    if (parts[1]) {
      navigate(`/${parts[1]}/${value}`);
    }
  };

  const toggleSidebar = () => {
    setShow(!show);
  };

  return (
    <div className={`wx-demos layout wx-${skin}-theme ${show ? 'active' : ''}`}>
      <div
        className={`wx-demos sidebar ${show ? 'active' : ''}`}
        role="tabpanel"
      >
        <div className="wx-demos sidebar-content">
          <div className="wx-demos sidebar-header">
            <div className="wx-demos box-title">
              <img src={LogoIcon} alt="Logo icon" className="box-title-img" />
              <div className="wx-demos separator"></div>
              <h1 className="wx-demos title">React {publicName}</h1>
            </div>
            <div className="wx-demos btn-box">
              <Button
                type="secondary"
                icon="wxi-angle-left"
                css="toggle-btn"
                onClick={toggleSidebar}
              ></Button>
            </div>
          </div>
          <div className="wx-demos box-links">
            {links
              .map((data, index) => {
                // Check if this is a group header (no path starting with '/')
                if (!data[0].startsWith('/')) {
                  return (
                    <details key={`group-${index}`}>
                      <summary className="wx-demos group-header">
                        {data[0]}
                      </summary>
                      <div className="wx-demos group-content">
                        {/* Render items until next group or end */}
                        {links
                          .slice(index + 1)
                          .map((item) => {
                            if (!item[0].startsWith('/')) return null; // Stop at next group
                            return (
                              <NavLink
                                key={item[0]}
                                to={item[0].replace(':skin', skin)}
                                className={({ isActive }) =>
                                  `wx-demos demo ${isActive ? 'active' : ''}`
                                }
                              >
                                {item[1]}
                              </NavLink>
                            );
                          })
                          .filter(Boolean)
                          .slice(
                            0,
                            links
                              .slice(index + 1)
                              .findIndex((item) => !item[0].startsWith('/')),
                          )}
                      </div>
                    </details>
                  );
                }
                // Check if this item is part of a group (previous item was a group header)
                if (index > 0 && !links[index - 1][0].startsWith('/')) {
                  return null; // Already rendered as part of the group
                }
                // Check if any previous item is a group that hasn't been closed
                let inGroup = false;
                for (let i = index - 1; i >= 0; i--) {
                  if (!links[i][0].startsWith('/')) {
                    inGroup = true;
                    break;
                  }
                }
                if (inGroup) return null;

                // Regular link (not in a group)
                return (
                  <NavLink
                    key={data[0]}
                    to={data[0].replace(':skin', skin)}
                    className={({ isActive }) =>
                      `wx-demos demo ${isActive ? 'active' : ''}`
                    }
                  >
                    {data[1]}
                  </NavLink>
                );
              })
              .filter(Boolean)}
          </div>
        </div>
      </div>

      <div className="wx-demos page-content">
        <div className="wx-demos page-content-header">
          <div className="wx-demos header-title-box">
            {!show && (
              <div className="wx-demos btn-box">
                <Button
                  type="secondary"
                  icon="wxi-angle-right"
                  css="toggle-btn"
                  onClick={toggleSidebar}
                />
              </div>
            )}
            <div className="wx-demos hint">{title}</div>
          </div>
          <div className="wx-demos header-actions-container">
            <div className="wx-demos segmented-box">
              <Segmented
                value={skin}
                options={skins}
                css="segmented-themes"
                onChange={handleSkinChange}
              />
            </div>
            <div className="wx-demos btn-box">
              <a href={githubLink} target="_blank" rel="noopener noreferrer">
                <Button type="secondary" css="toggle-btn">
                  See code on GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>

        <div
          className="wx-demos wrapper-content"
          onClick={() => setShow(false)}
          role="none"
        >
          <div
            className={`wx-demos content wx-${skin}-theme`}
            role="none"
            data-wx-portal-root="true"
          >
            <Globals>
              <Router skin={skin} onRouteChange={handleRouteChange} />
            </Globals>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoExplorer(props) {
  const skins = props.skins;
  return (
    <>
      {skins.map((skin) => (
        <skin.Component key={skin.id} />
      ))}
      <HashRouter>
        <DemoExplorerContent {...props} />
      </HashRouter>
    </>
  );
}
