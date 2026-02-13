// @ts-nocheck
import { useContext, useMemo } from 'react';
import { Toolbar as WxToolbar } from '@svar-ui/react-toolbar';
import { useStoreLater } from '@svar-ui/lib-react';
import {
  handleAction,
  defaultToolbarButtons,
  isHandledAction,
} from '@svar-ui/gantt-store';
import { locale } from '@svar-ui/lib-dom';
import { en } from '@svar-ui/gantt-locales';
import { context } from '@svar-ui/react-core';

// Custom locale for Gantt integration
const ganttLocale = {
  gantt: {
    ...en.gantt,
    'New task': 'Issue', // Override toolbar button text
  },
};

export default function Toolbar({
  api = null,
  items = [...defaultToolbarButtons],
  onAddMilestone = null,
  onOpenBlueprints = null,
}) {
  const i18nCtx = useContext(context.i18n);
  const i18nLocal = useMemo(
    () => (i18nCtx ? i18nCtx : locale(ganttLocale)),
    [i18nCtx],
  );
  const _ = useMemo(() => i18nLocal.getGroup('gantt'), [i18nLocal]);

  const rSelected = useStoreLater(api, '_selected');
  const rTasks = useStoreLater(api, '_tasks');

  const finalItems = useMemo(() => {
    const baseItems = items.map((b) => {
      let item = { ...b, disabled: false };
      item.handler = isHandledAction(defaultToolbarButtons, item.id)
        ? (it) => {
            // Guard against null api to prevent "Cannot read properties of null (reading 'getState')" error
            if (!api) {
              console.warn(
                '[Toolbar] Cannot execute action: Gantt API not initialized',
              );
              return;
            }
            handleAction(api, it.id, null, _);
          }
        : item.handler;
      if (item.text) item.text = _(item.text);
      if (item.menuText) item.menuText = _(item.menuText);
      return item;
    });

    // Add milestone button right after the first button (add task) if onAddMilestone is provided
    if (onAddMilestone) {
      baseItems.splice(1, 0, {
        id: 'add-milestone',
        comp: 'button',
        icon: 'wxi-plus',
        text: 'Milestone',
        type: 'primary',
        handler: onAddMilestone,
      });
    }

    // Add blueprints button right after milestone button if onOpenBlueprints is provided
    if (onOpenBlueprints) {
      // Position: after add-task (0) and add-milestone (1), so index 2
      const insertIndex = onAddMilestone ? 2 : 1;
      baseItems.splice(insertIndex, 0, {
        id: 'blueprints',
        comp: 'button',
        icon: 'wxi-plus',
        text: 'Blueprints',
        type: 'primary',
        handler: onOpenBlueprints,
      });
    }

    return baseItems;
  }, [items, api, _, onAddMilestone, onOpenBlueprints]);

  const buttons = useMemo(() => {
    if (api && rSelected?.length) {
      // When tasks are selected, show all buttons
      return finalItems.map((item) => {
        if (!item.check) return item;
        const isDisabled = rSelected.some((task) => !item.check(task, rTasks));
        return { ...item, disabled: isDisabled };
      });
    }
    // When no tasks are selected, show only add-task, add-milestone, and blueprints buttons
    return finalItems.filter(
      (item) =>
        item.id === 'add-task' ||
        item.id === 'add-milestone' ||
        item.id === 'blueprints',
    );
  }, [api, rSelected, rTasks, finalItems]);

  if (!i18nCtx) {
    return (
      <context.i18n.Provider value={i18nLocal}>
        <WxToolbar items={buttons} />
      </context.i18n.Provider>
    );
  }

  return <WxToolbar items={buttons} />;
}
