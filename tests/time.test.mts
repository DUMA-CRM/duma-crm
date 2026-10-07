import assert from 'node:assert/strict';
import test from 'node:test';

const { displayTime, formatTime, from12Hour, hourValues, minuteValues, parseTime, to12Hour } = await import('../lib/utils/time.ts');

test('times parse from the stored HH:MM string, and junk does not', () => {
  assert.deepEqual(parseTime('09:41'), { hour: 9, minute: 41 });
  assert.deepEqual(parseTime('9:05'), { hour: 9, minute: 5 });
  assert.deepEqual(parseTime('23:59:30'), { hour: 23, minute: 59 });
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('12:60'), null);
  assert.equal(parseTime(''), null);
  assert.equal(formatTime(7, 3), '07:03');
});

test('12-hour conversion round-trips every hour, including midnight and noon', () => {
  assert.deepEqual(to12Hour(0), { hour: 12, meridiem: 'AM' });
  assert.deepEqual(to12Hour(12), { hour: 12, meridiem: 'PM' });
  assert.deepEqual(to12Hour(13), { hour: 1, meridiem: 'PM' });
  for (let hour = 0; hour < 24; hour += 1) {
    const face = to12Hour(hour);
    assert.equal(from12Hour(face.hour, face.meridiem), hour);
  }
});

test('the trigger reads in the chosen clock', () => {
  assert.equal(displayTime('09:41'), '09:41');
  assert.equal(displayTime('21:05', '12h'), '9:05 PM');
  assert.equal(displayTime('00:30', '12h'), '12:30 AM');
  assert.equal(displayTime('nope'), '');
});

test('minute wheels step, and never hide the stored minute', () => {
  assert.deepEqual(minuteValues(15), [0, 15, 30, 45]);
  assert.deepEqual(minuteValues(15, 7), [0, 7, 15, 30, 45]);
  assert.equal(minuteValues(1).length, 60);
  assert.equal(minuteValues(0).length, 60, 'a nonsense step falls back to every minute');
  assert.equal(hourValues('24h').length, 24);
  assert.deepEqual(hourValues('12h').slice(0, 2), [1, 2]);
});
