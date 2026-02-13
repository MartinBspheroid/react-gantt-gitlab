import './MyTaskContent.css';

function MyTaskContent({ data, onAction }) {
  function doClick(ev) {
    ev.stopPropagation();
    onAction({
      action: 'custom-click',
      data: {
        clicked: !data.clicked,
        id: data.id,
      },
    });
  }

  return (
    <>
      {data.type !== 'milestone' ? (
        <>
          <div className="wx-BzRGIq8x wx-text-out text-right">
            {data.text || ''}
          </div>
          <button className="wx-BzRGIq8x" onClick={doClick}>
            {data.clicked ? 'Was clicked' : 'Click Me'}
          </button>
        </>
      ) : (
        <div className="wx-BzRGIq8x wx-text-out text-left">
          {data.text || ''}
        </div>
      )}
    </>
  );
}

export default MyTaskContent;
