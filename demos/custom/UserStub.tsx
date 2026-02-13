import { useMemo } from 'react';
import './UserStub.css';

function UserStub(props) {
  const { user } = props;

  const url = 'https://svar.dev/demos/grid/assets/avatars/';
  const avatar = useMemo(
    () => (user ? `${url}${user.label.replace(' ', '_')}.png` : ''),
    [user],
  );

  return (
    <div className="wx-Md6hA5Em container">
      <div className="wx-Md6hA5Em avatar">
        {avatar ? (
          <div className="wx-Md6hA5Em user-avatar">
            <img className="wx-Md6hA5Em user-photo" alt="" src={avatar} />
          </div>
        ) : null}
      </div>
      <div>{user?.label ?? ''}</div>
    </div>
  );
}

export default UserStub;
