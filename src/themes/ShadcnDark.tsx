// @ts-nocheck
import './ShadcnDark.css';

function ShadcnDark({ _fonts = true, children }) {
  return children ? (
    <div className="wx-shadcn-dark-theme">{children}</div>
  ) : (
    <div className="wx-shadcn-dark-theme" />
  );
}

export default ShadcnDark;
