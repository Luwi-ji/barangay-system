import { getStatusColor, formatStatus } from '../../utils/helpers'

export default function StatusBadge({ status }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {formatStatus(status)}
    </span>
  )
}