export default function StatusBadge({ status }) {
  if (!status) return null;

  let modifier = 'neutral';

  switch (status) {
    case 'pending':
    case 'otp_pending':
      modifier = 'warn';
      break;
    case 'active':
      modifier = 'success';
      break;
    case 'completed':
      modifier = 'neutral';
      break;
    case 'cancelled':
    case 'suspended':
      modifier = 'danger';
      break;
    default:
      modifier = 'neutral';
  }

  const displayStatus = status.replace('_', ' ');

  return (
    <span className={`status-badge status-badge--${modifier}`}>
      {displayStatus}
    </span>
  );
}
