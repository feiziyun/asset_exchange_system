const statuses = {
  CREATED: 'pending', DATA_READY: 'ready', SUBMITTING: 'computing',
  AUDIT_PENDING: 'computing', AUDIT_PASSED: 'done',
  AUDIT_FAILED: 'failed', AUDIT_TIMEOUT: 'failed', FAILED: 'failed',
}

export function mapMpcAuditJob(job) {
  if (!job) return null
  const status = String(job.status || '').toUpperCase()
  return {
    audit_mode: 'MPC_COMPOSITE',
    transaction_id: job.transaction_id,
    remote_task_id: job.pam_event_id || job.transaction_id,
    task_status: statuses[status] || 'pending',
    audit_status: status,
    pam_event_id: job.pam_event_id || null,
    consensus_status: job.consensus_status || null,
    consensus_result: job.consensus_result || null,
    passed_nodes: Number(job.passed_nodes || 0),
    responded_nodes: Number(job.responded_nodes || 0),
    compute_params: { threshold: job.threshold, coefficient: job.coefficient },
    result: job.result || null,
    last_error: job.last_error || null,
  }
}
