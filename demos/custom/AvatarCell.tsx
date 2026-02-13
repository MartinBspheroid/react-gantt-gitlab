import { useMemo } from 'react';
import UserStub from './UserStub.tsx';
import { users } from '../data';

function AvatarCell(props) {
  const { row } = props;

  const user = useMemo(
    () => users.find((u) => u.id == row.assigned),
    [row.assigned, users],
  );

  return <UserStub user={user} />;
}

export default AvatarCell;
