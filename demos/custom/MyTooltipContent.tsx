import { format } from 'date-fns';
import './MyTooltipContent.css';

function MyTooltipContent(props) {
  const { data } = props;

  const mask = 'yyyy.MM.dd';
  return (
    <>
      {data ? (
        <div className="wx-SfydHtKO data">
          <div className="wx-SfydHtKO text">
            <span className="wx-SfydHtKO caption">{data.type}: </span>
            {data.text}
          </div>
          <div className="wx-SfydHtKO text">
            <span className="wx-SfydHtKO caption">start: </span>
            {format(data.start, mask)}
          </div>
          {data.end ? (
            <div className="wx-SfydHtKO text">
              <span className="wx-SfydHtKO caption">end: </span>
              {format(data.end, mask)}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export default MyTooltipContent;
