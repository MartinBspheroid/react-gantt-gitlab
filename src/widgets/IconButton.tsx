// @ts-nocheck
import './IconButton.css';

export default function IconButton({
  appearance = 'primary',
  icon = '',
  onClick,
}) {
  return (
    <button className={`wx-TyZ1fHBj wx-button ${appearance}`} onClick={onClick}>
      {icon ? <i className={`wx-TyZ1fHBj wx-button-icon ${icon}`}></i> : null}
    </button>
  );
}
