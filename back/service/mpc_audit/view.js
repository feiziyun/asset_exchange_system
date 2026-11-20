'use strict';

const parseJson = value => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
};

const taskStatus = status => ({
  CREATED: 'pending', DATA_READY: 'ready', SUBMITTING: 'computing',
  AUDIT_PENDING: 'computing', AUDIT_PASSED: 'done',
  AUDIT_FAILED: 'failed', AUDIT_TIMEOUT: 'failed', FAILED: 'failed'
})[String(status || '').toUpperCase()] || 'pending';

function mapMpcAuditRecord(job) {
  if (!job) return null;
  return {
    audit_mode: 'MPC_COMPOSITE',
    transaction_id: job.transaction_id,
    remote_task_id: job.pam_event_id || job.transaction_id,
    task_status: taskStatus(job.status),
    audit_status: job.status,
    pam_event_id: job.pam_event_id || null,
    consensus_status: job.consensus_status || null,
    consensus_result: job.consensus_result || null,
    responded_nodes: Number(job.responded_nodes || 0),
    passed_nodes: Number(job.passed_nodes || 0),
    target_nodes: parseJson(job.target_nodes_json) || job.target_nodes || [],
    compute_params: { threshold: job.threshold, coefficient: job.coefficient },
    result: parseJson(job.result_json) || job.result || null,
    last_error: job.last_error || null,
  };
}

module.exports = { mapMpcAuditRecord, taskStatus };
