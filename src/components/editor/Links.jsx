import { useState, useEffect, useMemo, useContext } from 'react';
import { Field, Combo } from '@svar-ui/react-core';
import { context } from '@svar-ui/react-core';
import { useStore } from '@svar-ui/lib-react';
import './Links.css';

export default function Links({ api, autoSave, onLinksChange }) {
  const i18n = useContext(context.i18n);
  const _ = i18n.getGroup('gantt');

  const activeTask = useStore(api, 'activeTask');
  const links = useStore(api, '_links');

  const [linksData, setLinksData] = useState();

  function getLinksData() {
    if (activeTask) {
      const inLinks = links
        .filter((a) => a.target == activeTask)
        .map((link) => ({ link, task: api.getTask(link.source) }));

      const outLinks = links
        .filter((a) => a.source == activeTask)
        .map((link) => ({ link, task: api.getTask(link.target) }));

      return [
        { title: _('Predecessors'), data: inLinks },
        { title: _('Successors'), data: outLinks },
      ];
    }
  }

  useEffect(() => {
    setLinksData(getLinksData());
  }, [activeTask, links]);

  const list = useMemo(
    () => [
      { id: 'e2s', label: _('End-to-start') },
      { id: 's2s', label: _('Start-to-start') },
      { id: 'e2e', label: _('End-to-end') },
      { id: 's2e', label: _('Start-to-end') },
    ],
    [_],
  );

  function deleteLink(id, linkObj) {
    if (autoSave) {
      // Pass full link object with source/target for handler to find correct link
      api.exec('delete-link', { id, link: linkObj });
    } else {
      setLinksData((prev) =>
        (prev || []).map((group) => ({
          ...group,
          data: group.data.filter((item) => item.link.id !== id),
        })),
      );
      // Pass full link object for source/target info needed by delete handler
      onLinksChange &&
        onLinksChange({
          id,
          action: 'delete-link',
          data: { id, link: linkObj },
        });
    }
  }

  function handleChange(ev, id) {
    const value = ev.value;
    if (autoSave) {
      // NOTE: GitLab API doesn't support updating link types.
      // GitLab only supports one link type (blocks/is_blocked_by which maps to e2s).
      // This event will update the Gantt store locally but won't sync to GitLab.
      api.exec('update-link', {
        id,
        link: { type: value },
      });
    } else {
      setLinksData((prev) =>
        (prev || []).map((group) => ({
          ...group,
          data: group.data.map((item) =>
            item.link.id === id
              ? { ...item, link: { ...item.link, type: value } }
              : item,
          ),
        })),
      );
      onLinksChange &&
        onLinksChange({
          id,
          action: 'update-link',
          data: {
            id,
            link: { type: value },
          },
        });
    }
  }

  return (
    <>
      {(linksData || []).map((group, idx) =>
        group.data.length ? (
          <div className="wx-j93aYGQf wx-links" key={idx}>
            <Field label={group.title} position="top">
              <table>
                <tbody>
                  {group.data.map((obj) => (
                    <tr key={obj.link.id}>
                      <td className="wx-j93aYGQf wx-cell">
                        <div className="wx-j93aYGQf wx-task-name">
                          {obj.task.text || ''}
                        </div>
                      </td>

                      <td className="wx-j93aYGQf wx-cell">
                        <div className="wx-j93aYGQf wx-wrapper">
                          <Combo
                            value={obj.link.type}
                            placeholder={_('Select link type')}
                            options={list}
                            onChange={(e) => handleChange(e, obj.link.id)}
                          >
                            {({ option }) => option.label}
                          </Combo>
                        </div>
                      </td>

                      <td className="wx-j93aYGQf wx-cell">
                        <i
                          className="wx-j93aYGQf wxi-delete wx-delete-icon"
                          onClick={() => deleteLink(obj.link.id, obj.link)}
                          role="button"
                        ></i>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Field>
          </div>
        ) : null,
      )}
    </>
  );
}
