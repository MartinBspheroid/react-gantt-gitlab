// @ts-nocheck
import { DatePicker, TimePicker } from '@svar-ui/react-core';
import './DateTimePicker.css';

/**
 * DateTimePicker component for editing dates in the Editor sidebar.
 *
 * @param {Object} props
 * @param {Date|null} props.value - Current date value
 * @param {boolean} props.time - Whether to show time picker
 * @param {string} props.format - Date format string
 * @param {boolean} props.clearable - Whether to show clear button (default: false)
 * @param {Function} props.onChange - Change handler
 */
export default function DateTimePicker(props) {
  const {
    value,
    time,
    format,
    onchange,
    onChange,
    clearable = false,
    ...restProps
  } = props;
  const onChangeHandler = onChange ?? onchange;

  function handleDateChange(ev) {
    // Handle clear action - when user clicks clear button, ev.value is null
    if (ev.value === null) {
      onChangeHandler && onChangeHandler({ value: null });
      return;
    }

    const current = new Date(ev.value);
    // Preserve time from previous value if exists
    if (value instanceof Date) {
      current.setHours(value.getHours());
      current.setMinutes(value.getMinutes());
    }

    onChangeHandler && onChangeHandler({ value: current });
  }

  return (
    <div className="wx-hFsbgDln date-time-controll">
      <DatePicker
        {...restProps}
        value={value}
        onChange={handleDateChange}
        format={format}
        buttons={['today']}
        clear={clearable}
      />
      {time ? (
        <TimePicker value={value} onChange={onChangeHandler} format={format} />
      ) : null}
    </div>
  );
}
