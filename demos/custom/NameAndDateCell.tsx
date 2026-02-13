import { useMemo } from 'react';
import './NameAndDateCell.css';

export default function NameAndDateCell({ row }) {
  const date = useMemo(() => row.start.toLocaleDateString(), [row.start]);

  return (
    <>
      <div className="wx-4qJ64Gcp text">{row.text}</div>
      <div className="wx-4qJ64Gcp date">{date}</div>
    </>
  );
}
