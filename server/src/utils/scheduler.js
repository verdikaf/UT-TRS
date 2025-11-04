export function computeOffsetMs(reminderOffset) {
  switch (reminderOffset) {
    case '3d':
      return 3 * 24 * 60 * 60 * 1000;
    case '1d':
      return 24 * 60 * 60 * 1000;
    case '3h':
      return 3 * 60 * 60 * 1000;
    default:
      throw new Error('Invalid reminderOffset');
  }
}

export function computeInitialSendTime(deadline, reminderOffset, reminderType) {
  const offsetMs = computeOffsetMs(reminderOffset);
  let sendAt = new Date(deadline.getTime() - offsetMs);
  const now = new Date();

  if (sendAt <= now) {
    if (reminderType === 'weekly') {
      // advance week-by-week until in the future
      while (sendAt <= now) {
        sendAt = new Date(sendAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        deadline = new Date(deadline.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
      return { sendAt, normalizedDeadline: deadline };
    } else {
      // once: schedule a minute in the future
      sendAt = new Date(now.getTime() + 60 * 1000);
      return { sendAt, normalizedDeadline: deadline };
    }
  }
  return { sendAt, normalizedDeadline: deadline };
}

export function computeNextWeekly(deadline, reminderOffset) {
  const nextDeadline = new Date(deadline.getTime() + 7 * 24 * 60 * 60 * 1000);
  const sendAt = new Date(nextDeadline.getTime() - computeOffsetMs(reminderOffset));
  return { nextDeadline, sendAt };
}
