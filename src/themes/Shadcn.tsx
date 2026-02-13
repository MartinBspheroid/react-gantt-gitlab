// @ts-nocheck
import './Shadcn.css';

function Shadcn({ _fonts = true, children }) {
  return children ? (
    <div className="wx-shadcn-theme">{children}</div>
  ) : (
    <div className="wx-shadcn-theme" />
  );
}

export default Shadcn;
