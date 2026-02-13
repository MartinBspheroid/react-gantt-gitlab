import { useContext, useMemo } from 'react';
import { context } from '@svar-ui/react-core';
import './AddTaskCell.css';

export default function AddTaskCell() {
  const i18n = useContext(context.i18n);
  const _ = useMemo(() => i18n.getGroup('gantt'), []);
  const text = useMemo(() => _('Add task'), []);

  return (
    <div className="wx-4RuF7aAO text" data-action="add-task">
      {text}
    </div>
  );
}
